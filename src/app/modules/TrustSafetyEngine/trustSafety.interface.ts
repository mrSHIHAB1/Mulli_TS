import { Types } from 'mongoose';

export enum ReportType {
  HARASSMENT = 'Harassment or abusive behavior',
  INAPPROPRIATE_CONTENT = 'Inappropriate sexual messages or content',
  HATE_SPEECH = 'Hate speech or discrimination',
  THREATS = 'Threats or made me feel unsafe',
  FAKE_PROFILE = 'Fake profile / not a real person',
  STOLEN_PHOTOS = 'Using someone else’s photos',
  LYING = 'Lying about who they are',
  POOR_BEHAVIOR = 'Poor behavior during a round',
  NO_SHOW = 'No-show / cancelled last minute',
  SOMETHING_ELSE = 'Something else',
}

export enum ReportSeverity {
  SERIOUS = 'Serious',
  MILD = 'Mild',
}

export interface IReport {
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  reportType: ReportType;
  severity: ReportSeverity;
  details?: string;
  status: 'Pending' | 'Reviewed' | 'Resolved';
  createdAt: Date;
  updatedAt: Date;
}

export interface ITrustScoreLog {
  userId: Types.ObjectId;
  changeAmount: number;
  newScore: number;
  reason: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
