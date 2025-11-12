import { test } from "bun:test";

let nextCardId = 0;

export function testWithAiDungeonEnvironment(
  testName: string,
  testFn: () => void | Promise<void>
): void {
  return test(testName, async () => {
    nextCardId = 0;

    globalThis.storyCards = [];
    globalThis.history = [];
    globalThis.info = {
      actionCount: 0,
      characters: [],
    };
    globalThis.state = {
      memory: {},
      message: "",
    };

    globalThis.log = (message: string): void => {
      // Silent in tests
    };

    globalThis.addStoryCard = ((
      keys: string,
      entry?: string,
      type: string = "Custom",
      name?: string,
      description?: string,
      options?: { returnCard: boolean }
    ): StoryCard | number => {
      const card: StoryCard = {
        id: `${nextCardId++}`,
        keys: keys ? [keys] : undefined,
        entry,
        type,
        title: name || keys,
        description: description || "",
      };
      globalThis.storyCards.push(card);

      if (options?.returnCard) {
        return card;
      }
      return globalThis.storyCards.length;
    }) as typeof globalThis.addStoryCard;

    globalThis.removeStoryCard = (index: number): void => {
      const card = globalThis.storyCards[index];
      if (card) {
        globalThis.storyCards.splice(index, 1);
      } else {
        throw new Error(
          `Story card not found at index ${index} in removeStoryCard`
        );
      }
    };

    globalThis.updateStoryCard = (
      index: number,
      keys: string,
      entry: string,
      type: string
    ): void => {
      const existing = globalThis.storyCards[index];
      if (existing) {
        globalThis.storyCards[index] = {
          id: existing.id,
          keys: keys ? [keys] : undefined,
          entry,
          type,
          title: existing.title,
          description: existing.description,
        };
      } else {
        throw new Error(
          `Story card not found at index ${index} in updateStoryCard`
        );
      }
    };

    try {
      await testFn();
    } finally {
      (globalThis as any).storyCards = undefined;
      (globalThis as any).history = undefined;
      (globalThis as any).info = undefined;
      (globalThis as any).state = undefined;
      (globalThis as any).log = undefined;
      (globalThis as any).addStoryCard = undefined;
      (globalThis as any).removeStoryCard = undefined;
      (globalThis as any).updateStoryCard = undefined;
    }
  });
}

export function createConfigCard(description: string): StoryCard {
  const length = globalThis.addStoryCard(
    "Configure FoxTweaks behavior",
    "",
    "class"
  );
  // We know addStoryCard returns number in this case (no returnCard option)
  const cardIndex =
    (typeof length === "number" ? length : globalThis.storyCards.length) - 1;
  const card = globalThis.storyCards[cardIndex];
  if (!card) {
    throw new Error("Failed to create config card");
  }
  card.title = "FoxTweaks Config";
  card.description = description;
  return card;
}

export function addHistoryAction(text: string, type: History["type"]): void {
  globalThis.history.push({ text, type });
}
