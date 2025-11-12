declare const storyCards: StoryCard[] | undefined;
declare function addStoryCard(keys: string): void;

/**
 * Finds a story card by title or keys
 * @param titleOrKeys - The title or keys to search for
 * @returns The matching card or null
 */
export function findCard(titleOrKeys: string): StoryCard | null {
  if (!storyCards) return null;

  for (let i = 0; i < storyCards.length; i++) {
    const card = storyCards[i];
    if (
      card &&
      (card.title === titleOrKeys || card.keys?.includes(titleOrKeys))
    ) {
      return card;
    }
  }

  return null;
}

/**
 * Pins specified cards to the top and sorts all cards by date
 * @param pinnedCards - Card or array of cards to pin to the top
 */
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

/**
 * Creates a new story card with the given keys
 * @param keys - The keys for the new card
 */
export function createStoryCard(keys: string): void {
  addStoryCard(keys);
}
