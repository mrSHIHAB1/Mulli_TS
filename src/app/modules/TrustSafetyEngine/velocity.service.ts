import { Message } from '../chat/chat.model';
import { Types } from 'mongoose';
import User from '../user/user.model';
import { TrustSafetyService } from './trustSafety.service';

export class VelocityService {
  /**
   * Checks if a user is messaging too many unique people in a short time.
   */
  static async checkMessagingVelocity(senderId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const uniqueReceivers = await Message.distinct('receiver', {
      sender: new Types.ObjectId(senderId),
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (uniqueReceivers.length >= 20) {
      await TrustSafetyService.updateTrustScore(
        new Types.ObjectId(senderId),
        -15,
        'Messaging velocity too high (20+ people in 5 mins)'
      );
      return true; // flagged
    }
    return false;
  }

  /**
   * Checks for copy-pasted messages to multiple users.
   */
  static async checkCopyPastePattern(senderId: string, text: string) {
    if (!text || text.length < 10) return false;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const duplicateCount = await Message.countDocuments({
      sender: new Types.ObjectId(senderId),
      'message.text': text,
      createdAt: { $gte: tenMinutesAgo },
    });

    if (duplicateCount >= 5) {
      await TrustSafetyService.updateTrustScore(
        new Types.ObjectId(senderId),
        -10,
        'Copy-paste message pattern detected'
      );
      return true;
    }
    return false;
  }

  /**
   * Checks if message contains links.
   */
  static async checkLinks(senderId: string, text: string) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(text)) {
      await TrustSafetyService.updateTrustScore(
        new Types.ObjectId(senderId),
        -5,
        'Sending links'
      );
      return true;
    }
    return false;
  }

  /**
   * Checks swiping velocity.
   */
  static async checkSwipingVelocity(userId: string) {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const { Swipe } = await import('../Swipe/swipe.model'); // Dynamic import to avoid circular dependency
    
    const swipeCount = await Swipe.countDocuments({
      fromUser: new Types.ObjectId(userId),
      createdAt: { $gte: oneMinuteAgo },
    });

    if (swipeCount >= 30) {
      await TrustSafetyService.updateTrustScore(
        new Types.ObjectId(userId),
        -10,
        'Swiping insanely fast (30+ swipes in 1 min)'
      );
      return true;
    }
    return false;
  }
}
