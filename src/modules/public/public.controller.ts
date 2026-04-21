import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformStatsDto } from './dto/platform-stats.dto';
import { PublicService } from './public.service';

@ApiTags('Public')
@Controller({ path: 'public', version: '1' })
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('platform-stats')
  @Public()
  @ApiOperation({
    summary: 'Get platform-wide public statistics (students, advisors, projects)',
  })
  @ApiResponse({ status: 200, description: 'Platform statistics retrieved successfully', type: PlatformStatsDto })
  async getPlatformStats(): Promise<PlatformStatsDto> {
    return this.publicService.getPlatformStats();
  }
}
