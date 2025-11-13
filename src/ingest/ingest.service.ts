import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/common/prisma.service";
import { CollectEventDto } from "./dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class IngestService {
    constructor(private readonly prisma: PrismaService) {}

    async store(appId: string, dto: CollectEventDto, ipFromReq?: string) {
        const ts = dto.timestamp ? new Date(dto.timestamp) : new Date();
        const ip = dto.ipAddress || ipFromReq;

        return this.prisma.event.create({
            data: {
                appId,
                event: dto.event,
                url: dto.url,
                referrer: dto.referrer,
                device: dto.device,
                ipAddress: ip ?? null,
                userId: dto.userId ?? null,
                ts,
                metadata: (dto.metadata ?? {}) as Prisma.JsonObject
            }
        })
    }
}