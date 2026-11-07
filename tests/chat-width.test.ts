import { describe, expect, it } from "vitest";
import {
  CHAT_WIDTH_DEFAULT,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_MIN,
  clampChatWidth,
  maxChatWidthForRow,
  parseStoredChatWidth,
} from "@/lib/chat-width";

describe("chat width", () => {
  it("defaults constants match the approved sheet size", () => {
    expect(CHAT_WIDTH_DEFAULT).toBe(380);
    expect(CHAT_WIDTH_MIN).toBe(320);
    expect(CHAT_WIDTH_MAX).toBe(640);
  });

  it("clamps between min and max when no ceiling", () => {
    expect(clampChatWidth(200)).toBe(CHAT_WIDTH_MIN);
    expect(clampChatWidth(CHAT_WIDTH_DEFAULT)).toBe(CHAT_WIDTH_DEFAULT);
    expect(clampChatWidth(900)).toBe(CHAT_WIDTH_MAX);
  });

  it("respects a row ceiling so the week sheet keeps room", () => {
    expect(clampChatWidth(600, 500)).toBe(500);
    expect(clampChatWidth(300, 400)).toBe(CHAT_WIDTH_MIN);
  });

  it("computes max width from row width minus week reserve", () => {
    expect(maxChatWidthForRow(1200)).toBe(640);
    expect(maxChatWidthForRow(800)).toBe(440);
    expect(maxChatWidthForRow(500)).toBe(CHAT_WIDTH_MIN);
  });

  it("ignores bad stored values", () => {
    expect(parseStoredChatWidth(null)).toBe(CHAT_WIDTH_DEFAULT);
    expect(parseStoredChatWidth("")).toBe(CHAT_WIDTH_DEFAULT);
    expect(parseStoredChatWidth("nope")).toBe(CHAT_WIDTH_DEFAULT);
    expect(parseStoredChatWidth("100")).toBe(CHAT_WIDTH_DEFAULT);
    expect(parseStoredChatWidth("700")).toBe(CHAT_WIDTH_DEFAULT);
    expect(parseStoredChatWidth("420")).toBe(420);
  });
});
