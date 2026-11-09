import type { AvatarStackPerson } from "@/components/common/Avatar";

export const sampleCollaborators: AvatarStackPerson[] = [
  { name: "Priya Shah", tone: "amber" },
  { name: "Marco Ruiz", tone: "sky" },
  { name: "Lena Okafor", tone: "rose" },
];

export const sampleUser = {
  name: "Alex Morgan",
  email: "alex@collabboard.app",
  tone: "teal",
} as const;
