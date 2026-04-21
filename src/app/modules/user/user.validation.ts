import { z } from "zod";
import { 
  CannabisUsage, 
  CommunicationStyle, 
  EducationPlan, 
  Energy, 
  Language, 
  Line,
  LoveLanguage, 
  Mentality, 
  moreAboutGender, 
  Pace, 
  PetType, 
  PlayPreference, 
  PlayStyle, 
  Politics, 
  SocialStyle, 
  Workout, 
  Zodiac 
} from "./user.interface";

/**
 * Validation schema for user profile update
 * Strictly validates allowed fields and rejects unknown properties
 */
const updateUserProfileZodSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  trackactivity: z.enum(["Once", "While_Using", "No"]).optional(),
  gender: z.enum(["Men", "Women", "Nonbinary", "ALL"]).optional(),
  genderPreference: z.enum(["Men", "Women", "Nonbinary", "ALL"]).optional(),
  hopingToFind: z.enum(["Long_Term", "Short_Term", "Casual", "Ethical"]).optional(),
  ethnicity: z.string().optional(),
  country: z.string().optional(),
  religion: z.string().optional(),
  skillLevel: z.enum(["Beginner", "Novice", "Intermediate", "Advanced", "Expert"]).optional(),
  handicaprange: z.object({
    minRange: z.number().optional(),
    maxRange: z.number().optional(),
  }).optional(),
  hasKids: z.boolean().optional(),
  wantsKids: z.enum(["Yes", "No", "Maybe", "Unsure"]).optional(),
  drinking: z.string().optional(),
  smoking: z.string().optional(),
  goodGolfBuddyQualities: z.array(z.string()).optional(),
  preferredGolfTimes: z.string().optional(),
  prompt: z.array(z.string()).optional(),
  languages: z.array(z.enum(Language)).optional(),
  bio: z.string().optional(),
  playstyle: z.enum(["Golf_Buddy", "Golf_Date"]).optional(),
  location: z.object({
    type: z.string().optional(),
    coordinates: z.tuple([z.number(), z.number()]).optional(),
    placeName: z.string().optional(),
  }).optional(),
  useLocation: z.boolean().optional(),
  preferredDistance: z.number().min(0).optional(),
  reciveNotifications: z.boolean().optional(),
  vibe: z.object({
    playStyles: z.enum(PlayStyle).optional(),
    pace: z.enum(Pace).optional(),
    courseVibes: z.enum(Energy).optional(),
  }).optional(),
  play: z.object({
    preferences: z.enum(PlayPreference).optional(),
    mentality: z.enum(Mentality).optional(),
    socialStyle: z.enum(SocialStyle).optional(),
  }).optional(),
  line: z.object({
    type: z.enum(Line).optional(),
    prompts: z.array(z.string()).optional(),
  }).optional(),
  moreAboutGender: z.enum(moreAboutGender).optional(),
  politics: z.enum(Politics).optional(),
  zodiac: z.enum(Zodiac).optional(),
  educationPlan: z.enum(EducationPlan).optional(),
  communicationStyle: z.enum(CommunicationStyle).optional(),
  loveLanguage: z.enum(LoveLanguage).optional(),
  cannabis: z.enum(CannabisUsage).optional(),
  workout: z.enum(Workout).optional(),
  petType: z.enum(PetType).optional(),
}).strict();

export const userValidation = {
  updateUserProfileZodSchema
};
