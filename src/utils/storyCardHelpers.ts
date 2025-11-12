export function findStoryCardById(id: string): StoryCard | undefined {
  if (!storyCards) return undefined;

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card && card.id === id) {
      return card;
    }
  }
  return undefined;
}

export function findStoryCard(
  predicate: (card: StoryCard) => boolean
): StoryCard | undefined {
  if (!storyCards) return undefined;

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card && predicate(card)) {
      return card;
    }
  }
  return undefined;
}

export function findStoryCardIndex(
  predicate: (card: StoryCard) => boolean
): number {
  if (!storyCards) return -1;

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card && predicate(card)) {
      return i;
    }
  }
  return -1;
}

export function updateStoryCardById(
  id: string,
  updates: Partial<StoryCard>
): boolean {
  if (!storyCards) return false;

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card && card.id === id) {
      Object.assign(card, updates);
      return true;
    }
  }
  return false;
}

export function removeStoryCardById(id: string): boolean {
  if (!storyCards) return false;

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (card && card.id === id) {
      storyCards.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function findConfigCard(): StoryCard | undefined {
  return findStoryCard((c) => c.title === "FoxTweaks Config");
}

export function findCard(titleOrKeys: string): StoryCard | undefined {
  if (!storyCards) return undefined;

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (
      card &&
      (card.title === titleOrKeys || card.keys?.includes(titleOrKeys))
    ) {
      return card;
    }
  }
  return undefined;
}

export function pinAndSortCards(pinnedCards: StoryCard | StoryCard[]): void {
  if (!storyCards || storyCards.length < 2) return;

  storyCards.sort((a, b) => {
    const dateA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const dateB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return dateB - dateA;
  });

  const cardsToPin = Array.isArray(pinnedCards) ? pinnedCards : [pinnedCards];
  for (let i = cardsToPin.length - 1; i >= 0; i--) {
    const card = cardsToPin[i];
    if (!card) continue;
    const index = storyCards.indexOf(card);
    if (index > 0) {
      storyCards.splice(index, 1);
      storyCards.unshift(card);
    }
  }
}

export function createStoryCard(keys: string): void {
  addStoryCard(keys);
}
