import { HELLO_EMAIL } from "./brand";

// Interim walkthrough channel — mailto until a real booking page exists.
const subject = encodeURIComponent("Book a 15-minute End Voicemail walkthrough");
const body = encodeURIComponent(
  "Hey Hasan, I want to see how End Voicemail would handle missed calls for my business."
);

export const BOOK_WALKTHROUGH_HREF = `mailto:${HELLO_EMAIL}?subject=${subject}&body=${body}`;
