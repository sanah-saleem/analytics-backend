import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { PrismaService } from 'src/common/prisma.service';
import * as argon2 from 'argon2';

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 32);

function makeApiKey() {
    const prefix = 'ak_' + nano().slice(0, 4);
    const body = nano();
    const full = `${prefix}_${body}`;
    return { prefix, body, full };
}

@Injectable()
export class ApiKeyService {
    constructor(private prisma: PrismaService) {}

    async ensureUser(email: string, provider: string = 'dev') {
        let user = await this.prisma.user.findUnique({ where : { email }});
        if (!user) {
            user = await this.prisma.user.create({ data : { email, provider }});
        }
        return user;
    }

    async registerApp(ownerEmail: string, name: string) {
        const user = await this.ensureUser(ownerEmail);
        const app = await this.prisma.app.create({ data: { name, ownerId: user.id }})
        return app;
    }

    async createKey(appId: string, expiresAt?: Date) {
        const app = await this.prisma.app.findUnique({ where: { id: appId }});
        if(!app) throw new NotFoundException('App not foud');

        const { prefix, full } = makeApiKey();
        const keyHash = await argon2.hash(full);

        const key = await this.prisma.apiKey.create({
            data: {
                appId: app.id,
                keyPrefix: prefix,
                keyHash,
                status: 'active',
                expiresAt: expiresAt ?? null,
            }
        });

        // return the plaintext once; never store it
        return { apiKeyId: key.id, apiKey: full, prefix, expiresAt: key.expiresAt };
    }

    async listKeys(appId: string) {
        return this.prisma.apiKey.findMany({
            where: { appId },
            select: { id: true, keyPrefix: true, status: true, createdAt: true, expiresAt: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async revoke(apiKeyId: string) {
        const key = await this.prisma.apiKey.findUnique({ where : { id: apiKeyId }});
        if(!key) throw new NotFoundException('Api key not found');
        if(key.status == 'revoked') return key;
        return this.prisma.apiKey.update({ where: { id: apiKeyId }, data: { status: 'revoked'}});
    }

    async regenerate(apiKeyId: string, expiresAt?: Date) {
        const prev = await this.prisma.apiKey.findUnique({ where: { id: apiKeyId}});
        if(!prev) throw new NotFoundException('Api key not found');

        //revoke previous key
        await this.prisma.apiKey.update({ where: { id: apiKeyId }, data: { status: 'revoked' } });

        //new key in same app
        const { prefix, full } = makeApiKey();
        const keyHash = await argon2.hash(full);

        const created = await this.prisma.apiKey.create({
            data: {
                appId: prev.appId,
                keyPrefix: prefix,
                keyHash,
                status: 'active',
                expiresAt: expiresAt ?? prev.expiresAt ?? null,
                regeneratedFromId: prev.id
            }
        });
        return { apiKeyId: created.id, apiKey: full, prefix, expiresAt: created.expiresAt };
    }

    //utility for later api-key auth
    async verifyFulKeyAndGetApp(fullKey: string) {
        const [prefix] = fullKey.split('_', 2); // "ak_xxxx"
        if (!prefix) throw new BadRequestException('Malformed API key');
        const candidates = await this.prisma.apiKey.findMany({ where: { keyPrefix: prefix, status: 'active' } });
        for (const k of candidates) {
        if (k.expiresAt && k.expiresAt < new Date()) continue;
        const ok = await argon2.verify(k.keyHash, fullKey);
        if (ok) {
            const app = await this.prisma.app.findUnique({ where: { id: k.appId } });
            return { key: k, app };
        }
        }
        return null;
    }

}