import { Types } from 'mongoose';
import User from '../user/user.model';
import { TrustScoreLog, Report } from './trustSafety.model';
import { ReportSeverity, ReportType } from './trustSafety.interface';

export class TrustSafetyService {
  static async updateTrustScore(
    userId: Types.ObjectId,
    changeAmount: number,
    reason: string,
    metadata?: Record<string, any>
  ) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const oldScore = user.trustScore || 70;
    let newScore = oldScore + changeAmount;

    // Clamp score between 0 and 100
    newScore = Math.max(0, Math.min(100, newScore));

    await User.findByIdAndUpdate(userId, { trustScore: newScore });

    await TrustScoreLog.create({
      userId,
      changeAmount,
      newScore,
      reason,
      metadata,
    });

    return newScore;
  }

  static async reportUser(data: {
    reporterId: string;
    reportedUserId: string;
    reportType: ReportType;
    details?: string;
  }) {
    const { reporterId, reportedUserId, reportType, details } = data;

    // Determine severity and penalty
    let severity = ReportSeverity.MILD;
    let penalty = -10;

    const seriousTypes = [
      ReportType.HARASSMENT,
      ReportType.INAPPROPRIATE_CONTENT,
      ReportType.HATE_SPEECH,
      ReportType.THREATS,
    ];

    if (seriousTypes.includes(reportType)) {
      severity = ReportSeverity.SERIOUS;
      penalty = -25;
    }

    // Add "Per occurrence" penalty of -5 as per user request (wPer occurrence = -5)
    const totalPenalty = penalty - 5;

    const report = await Report.create({
      reporterId,
      reportedUserId,
      reportType,
      severity,
      details,
    });

    // Update the reported user's score
    await this.updateTrustScore(
      new Types.ObjectId(reportedUserId),
      totalPenalty,
      `Reported for ${reportType}`,
      { reportId: report._id }
    );

    // Update report count in user model
    await User.findByIdAndUpdate(reportedUserId, {
      $inc: { reportCount: 1 },
    });

    return report;
  }

  static async handleProfileCompletion(userId: Types.ObjectId) {
    const user = await User.findById(userId).select('images bio isVerified trustScore');
    if (!user) return;

    // Check if reward already given
    const alreadyRewarded = await TrustScoreLog.findOne({
      userId,
      reason: 'Profile Completion',
    });
    if (alreadyRewarded) return;

    // Criteria: Photos + Bio + Verified Profile
    if (user.bio && user.images && user.images.length > 0 && user.isVerified) {
      await this.updateTrustScore(userId, 15, 'Profile Completion');
    }
  }

  static async handleMeaningfulConversation(userId: Types.ObjectId) {
    // Both sides exchange 5+ messages = +5
    await this.updateTrustScore(userId, 5, 'Meaningful Conversation');
  }

  static getTrustLevel(score: number) {
    if (score >= 80) return 'Green';
    if (score >= 60) return 'Yellow';
    if (score >= 40) return 'Orange';
    return 'Red';
  }

  static async banUser(userId: string) {
    const user = await User.findByIdAndUpdate(userId, {
      isActive: 'blocked',
      isblocked: true,
      trustScore: 0,
    });
    if (!user) throw new Error('User not found');
    return user;
  }

  static async getReportsForAdmin() {
    return await Report.find()
      .populate('reporterId', 'firstName lastName email')
      .populate('reportedUserId', 'firstName lastName email trustScore')
      .sort({ createdAt: -1 });
  }
}
