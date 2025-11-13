import { describe, test, expect, beforeEach } from "bun:test";
import { FoxTweaks } from "../core";
import { Redundancy } from "./redundancy";
import { testWithAiDungeonEnvironment } from "../test-utils";

interface History {
  text: string;
  type: "continue" | "say" | "do" | "story" | "see" | "start" | "unknown";
}

describe("Redundancy Module - Integration Tests", () => {
  testWithAiDungeonEnvironment(
    "should not duplicate output when similar content is processed twice",
    () => {
      const initialHistory: History[] = [
        { text: "You enter the dark room.", type: "do" },
        { text: "The room is dimly lit by a single candle.", type: "continue" },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const firstOutput = "A figure emerges from the shadows.";
      const processedFirst = hooks.onOutput(firstOutput);

      history = [...initialHistory, { text: processedFirst, type: "continue" }];

      const secondOutput = "A figure emerges from the shadows.";
      const processedSecond = hooks.onOutput(secondOutput);

      expect(processedSecond).toBe(secondOutput);
      expect(processedSecond).not.toContain(
        "A figure emerges from the shadows.A figure emerges from the shadows."
      );
    }
  );

  testWithAiDungeonEnvironment(
    "should not merge distinct sequential AI outputs",
    () => {
      const initialHistory: History[] = [
        { text: "You look around.", type: "do" },
        { text: "You see a tavern ahead.", type: "continue" },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const firstOutput = "You enter the tavern.";
      const processedFirst = hooks.onOutput(firstOutput);

      history = [...initialHistory, { text: processedFirst, type: "continue" }];

      const secondOutput = "The barkeep greets you warmly.";
      const processedSecond = hooks.onOutput(secondOutput);

      expect(processedSecond).toBe(secondOutput);
      expect(processedSecond).not.toContain("You enter the tavern");
    }
  );

  testWithAiDungeonEnvironment(
    "should remove overlapping content from AI output",
    () => {
      const initialHistory: History[] = [
        { text: "You approach the door.", type: "do" },
        {
          text: "You see a wooden door. It has strange markings.",
          type: "continue",
        },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const overlappingOutput =
        "It has strange markings. The markings glow faintly in the dark.";
      const processed = hooks.onOutput(overlappingOutput);

      expect(processed).toBe("The markings glow faintly in the dark.");
      expect(processed).not.toContain("You see a wooden door");
      expect(processed).not.toContain("It has strange markings");
    }
  );

  testWithAiDungeonEnvironment(
    "should find correct last AI message with player actions in between",
    () => {
      const historyWithPlayerActions: History[] = [
        { text: "You enter the room.", type: "do" },
        { text: "The room is dark and cold.", type: "continue" },
        { text: "I light a torch.", type: "say" },
        { text: "You look around carefully.", type: "do" },
        {
          text: "The torch illuminates ancient paintings on the walls.",
          type: "continue",
        },
      ];
      history = historyWithPlayerActions;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const newOutput = "The paintings depict a great battle.";
      const processed = hooks.onOutput(newOutput);

      expect(processed).toBe(newOutput);
      expect(processed).not.toContain("The room is dark and cold");
    }
  );

  testWithAiDungeonEnvironment(
    "should handle case where no previous AI output exists",
    () => {
      const historyWithoutAI: History[] = [
        { text: "You start your adventure.", type: "start" },
        { text: "You look around.", type: "do" },
      ];
      history = historyWithoutAI;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const firstAIOutput = "You find yourself in a mysterious forest.";
      const processed = hooks.onOutput(firstAIOutput);

      expect(processed).toBe(firstAIOutput);
    }
  );

  testWithAiDungeonEnvironment(
    "should not merge when module is disabled",
    () => {
      const initialHistory: History[] = [
        { text: "You enter the room.", type: "do" },
        { text: "The room is dark.", type: "continue" },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: false
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const output = "The room is dark. The room is very dark indeed.";
      const processed = hooks.onOutput(output);

      expect(processed).toBe(output);
    }
  );

  testWithAiDungeonEnvironment(
    "should not merge similar sentence structures with different meaning",
    () => {
      const initialHistory: History[] = [
        { text: "You look around the tavern.", type: "do" },
        {
          text: "You see many patrons drinking and laughing loudly.",
          type: "continue",
        },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const newOutput =
        "You see a mysterious figure sitting alone in the corner.";
      const processed = hooks.onOutput(newOutput);

      expect(processed).toBe(newOutput);
      expect(processed).not.toContain("many patrons");
    }
  );

  testWithAiDungeonEnvironment(
    "should not merge when sentences share common words but different context",
    () => {
      const initialHistory: History[] = [
        { text: "You approach the door.", type: "do" },
        {
          text: "You notice the door is made of ancient oak wood.",
          type: "continue",
        },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const newOutput = "You notice the handle is made of brass.";
      const processed = hooks.onOutput(newOutput);

      expect(processed).toBe(newOutput);
      expect(processed).not.toContain("oak wood");
    }
  );

  testWithAiDungeonEnvironment(
    "should handle case where previous output ends with sentence that looks similar to new output start",
    () => {
      const initialHistory: History[] = [
        { text: "You enter the castle.", type: "do" },
        {
          text: "The grand hall stretches before you. You see guards posted at every entrance.",
          type: "continue",
        },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      storyCards = [configCard];

      const hooks = core.createHooks();

      const newOutput = "You see servants hurrying about their duties.";
      const processed = hooks.onOutput(newOutput);

      expect(processed).toBe(newOutput);
      expect(processed.split("You see").length - 1).toBe(1);
    }
  );

  testWithAiDungeonEnvironment(
    "should not merge distinct sequential sentences that share a character name (real scenario)",
    () => {
      const initialHistory: History[] = [
        {
          text: ' You clear your throat softly. "Sorry," you say. "Didn\'t mean to interrupt."\n\nThe woman turns her head slightly, just enough for you to see the sharp line of her jaw and the tired slope of her nose. Her eyes are shadowed, the color unclear in the misty light. "It\'s fine," she says, her voice raspy, like she\'s been breathing steam for too long. "It\'s a public space."',
          type: "continue",
        },
        {
          text: ' She turns back toward the steaming water, her movements heavy with a fatigue that seems bone-deep. You hesitate for a moment longer, the damp gravel shifting under your feet. The air is thick with silence and minerals.\n\n"You look like you could use a moment alone," you say, starting to retreat.\n\n"It\'s not that," she replies, the words quiet but clear. She doesn\'t look at you again, just stares into the milky depths of the pool.',
          type: "continue",
        },
        {
          text: " You linger at the edge of the clearing, the mist beading on your jacket. Her dismissal feels less like a brush-off and more like an open-ended invitation to stay or go. Your grandfather's keys feel heavy in your pocket. You came out here to learn the place, and maybe that includes its people, too.\n\n",
          type: "continue",
        },
        {
          text: 'You take a slow step forward, your boots quiet on the damp gravel. "Rough day?"\n\nShe lets out a soft, humorless sound that isn\'t quite a laugh. "You could say that." She pulls the towel tighter around her shoulders, though the air is warm from the spring. "This place usually helps. Today it\'s just... hot water."\n\nYou move to the far end of the stone bench, leaving a respectful distance between you.',
          type: "continue",
        },
        {
          text: ' You lower yourself onto the cool stone, the bench damp beneath you. The steam from the pool wraps around your legs, warm and thick. "Sometimes it\'s just hot water," you agree, keeping your voice low. "Other times... it\'s something else."\n\nShe glances at you, a quick, assessing flicker of dark eyes before returning her gaze to the milky surface. "You\'re new."\n\n"James. I inherited the place."\n\nA slow nod. "Mira."',
          type: "continue",
        },
      ];
      history = initialHistory;

      const core = new FoxTweaks();
      core.registerModule(Redundancy);

      const configCard: StoryCard = {
        id: "0",
        title: "FoxTweaks Config",
        keys: ["Configure FoxTweaks behavior"],
        description: `--- Redundancy ---
Enable: true
SimilarityThreshold: 70`,
        type: "class",
        entry: "",
      };
      (globalThis as any).storyCards = [configCard];

      const hooks = core.createHooks();

      const newOutput =
        " You watch the steam curl off Mira's shoulders, her silence filling the space between you like the mist. She doesn't seem inclined to speak further, her attention fixed on the water as though waiting for it to speak back. You let the quiet stretch, matching her stillness.\n\nAfter a few minutes, she shifts, the towel rustling softly. \"They say these springs have memory,\" she murmurs, her voice still rough but softer now.";
      const processed = hooks.onOutput(newOutput);

      expect(processed).toBe(newOutput);
      expect(processed).not.toContain("You lower yourself");
      expect(processed).not.toContain("cool stone");
      expect(processed).not.toContain("A slow nod");
    }
  );
});
