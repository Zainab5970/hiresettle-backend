import { Controller, Get, Param, ParseIntPipe, UseGuards, Post, Body, Request, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MilestonesService } from './milestones.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SubmitProofDto } from './dto/submit-proof.dto';
import { DisputeMilestoneDto } from './dto/dispute-milestone.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { UserRole } from '@prisma/client';

@ApiTags('milestones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('engagements/:engagementId/milestones')
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get()
  @ApiOperation({ summary: 'List all milestones for an engagement' })
  findAll(@Param('engagementId') engagementId: string) {
    return this.milestonesService.findByEngagement(engagementId);
  }

  @Get(':index')
  @ApiOperation({ summary: 'Get a single milestone by index' })
  findOne(
    @Param('engagementId') engagementId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.milestonesService.findOne(engagementId, index);
  }

  @Get(':index/timer')
  @ApiOperation({ summary: 'Get retention countdown timer for a Locked milestone' })
  getTimer(
    @Param('engagementId') engagementId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.milestonesService.getRetentionTimer(engagementId, index);
  }

  @Post(':index/submit-proof')
  @ApiOperation({ summary: 'Submit proof documentation for a milestone (Recruiter only)' })
  async submitProof(
    @Request() req: any,
    @Param('engagementId') engagementId: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: SubmitProofDto,
  ) {
    if (req.user.role !== UserRole.RECRUITER) {
      throw new ForbiddenException('Only recruiters can submit milestone proofs.');
    }
    return this.milestonesService.submitProofFlow(engagementId, index, dto.proofHash);
  }

  @Post(':index/confirm')
  @ApiOperation({ summary: 'Confirm and release payment for a milestone (Company only)' })
  async confirm(
    @Request() req: any,
    @Param('engagementId') engagementId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    if (req.user.role !== UserRole.COMPANY) {
      throw new ForbiddenException('Only companies can confirm and release milestone payments.');
    }

    const milestone = await this.milestonesService.findOne(engagementId, index);
    if (milestone.type === 'RETENTION' && milestone.status === 'LOCKED') {
      const currentLedger = await this.milestonesService.getCurrentLedgerSequence();
      if (currentLedger < milestone.validAfterLedger) {
        throw new UnprocessableEntityException('Retention period has not elapsed.');
      }
    }

    return this.milestonesService.confirmFlow(engagementId, index);
  }

  @Post(':index/dispute')
  @ApiOperation({ summary: 'Raise an official structural dispute on a milestone' })
  async dispute(
    @Request() req: any,
    @Param('engagementId') engagementId: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: DisputeMilestoneDto,
  ) {
    if (req.user.role !== UserRole.COMPANY && req.user.role !== UserRole.RECRUITER) {
      throw new ForbiddenException('Only companies or recruiters can raise disputes.');
    }
    return this.milestonesService.disputeFlow(engagementId, index, dto.reason);
  }

  @Post(':index/resolve-dispute')
  @ApiOperation({ summary: 'Resolve an active dispute selection (Arbiter only)' })
  async resolveDispute(
    @Request() req: any,
    @Param('engagementId') engagementId: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: ResolveDisputeDto,
  ) {
    if (req.user.role !== UserRole.ARBITER) {
      throw new ForbiddenException('Only assigned arbiters can resolve structural disputes.');
    }
    return this.milestonesService.resolveDisputeFlow(engagementId, index, dto.resolution);
  }
}
