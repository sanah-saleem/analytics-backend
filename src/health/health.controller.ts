import { Controller, Get } from "@nestjs/common";
import { PrismaService } from '../common/prisma.service';

@Controller('healthz')
export class HealthController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    ok() {
        return { status: 'ok', time: new Date().toISOString() };
    }

    @Get('db')
    async db() {
        await this.prisma.$queryRaw`SELECT 1`;
        return { db: 'ok', time: new Date().toISOString() };
    }
}