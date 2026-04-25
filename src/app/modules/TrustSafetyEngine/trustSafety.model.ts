import { Schema, model } from 'mongoose';
import { IReport, ITrustScoreLog, ReportSeverity, ReportType } from './trustSafety.interface';

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportType: {
      type: String,
      enum: Object.values(ReportType),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(ReportSeverity),
      required: true,
    },
    details: { type: String },
    status: {
      type: String,
      enum: ['Pending', 'Reviewed', 'Resolved'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

const TrustScoreLogSchema = new Schema<ITrustScoreLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changeAmount: { type: Number, required: true },
    newScore: { type: Number, required: true },
    reason: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Report = model<IReport>('Report', ReportSchema);
export const TrustScoreLog = model<ITrustScoreLog>('TrustScoreLog', TrustScoreLogSchema);
