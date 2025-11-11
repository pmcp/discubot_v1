# Discubot: Explained Like You're 5

**Date**: 2025-11-11 (Revised - Lean Architecture)
**For**: Understanding the big picture
**Version**: 2.0 (Simplified from 6 collections to 4)

---

## What is Discubot?

Imagine you and your friends are drawing pictures together in Figma or chatting in Slack. Sometimes during these conversations, you realize "Oh! We need to do this thing!" But then everyone forgets about it.

**Discubot is like a smart robot assistant** that:
1. **Listens** to your conversations in Figma and Slack
2. **Understands** what you're talking about using AI (like ChatGPT)
3. **Creates** task cards in Notion so you don't forget
4. **Tells you** "Hey, I made a task for you!"

## The Problem It Solves

### Before Discubot:
- You mention @Maarten in a Figma comment saying "We should fix the login button"
- Maarten reads it... and then forgets
- Nothing happens
- The login button stays broken

### After Discubot:
- You mention @DiscubotAI in the comment
- Discubot reads the whole conversation
- Discubot creates a task in Notion: "Fix login button"
- Discubot replies in Figma: "✅ I created a task!"
- Your team sees the task in Notion and fixes it

## How Does It Work? (Simple Version)

Think of Discubot like a helpful mail carrier:

```
1. 📬 INBOX: You mention the bot in Figma or Slack
2. 👀 READING: Bot reads the whole conversation
3. 🧠 THINKING: AI figures out what tasks need to be done
4. ✍️ WRITING: Bot creates task cards in Notion
5. 📣 TELLING: Bot replies to tell you it's done
```

## The Magic Ingredients

### 1. **Figma & Slack** (Where you talk)
Like walkie-talkies where your team discusses things

### 2. **Claude AI** (The brain)
Like having a really smart friend who reads everything and understands what's important

### 3. **Notion** (Where tasks live)
Like a bulletin board where you pin all your to-do cards

### 4. **Discubot** (The connector)
The robot that moves information between all three places

## Why Build It From Scratch?

You already built a proof-of-concept (called "figno") that works with Figma. But now you want to make it better:

### The Old Way (Figno):
- Only works with Figma ❌
- Hard to add Slack or other tools ❌
- Lots of complicated code ❌
- Takes forever to add new features ❌

### The New Way (Discubot):
- Works with Figma AND Slack ✅
- Easy to add Discord, Teams, Linear, etc. ✅
- Uses crouton to auto-generate simple code ✅
- Like building with LEGO blocks - add pieces easily ✅

## The Secret Sauce: "Adapters"

Think of adapters like puzzle pieces that fit into the same slot:

```
┌─────────────┐
│   Figma     │ ← Different shapes (sources)
│   Adapter   │
└──────┬──────┘
       │
       ├─────→ [Same Processing Machine]
       │
┌──────┴──────┐
│   Slack     │ ← Different shapes (sources)
│   Adapter   │
└─────────────┘
       │
       ↓
   Same Output (Notion tasks!)
```

**Each adapter knows how to:**
- Get messages from its source (Figma, Slack, etc.)
- Send messages back to its source
- Put reactions (👀, ✅, ❌)

**The processing machine does the same work for everyone:**
- Read the discussion
- Ask AI to summarize
- Create Notion tasks
- Send confirmation

## What's Nuxt-Crouton?

Imagine you want to build a treehouse. You could:
1. Cut every piece of wood yourself (slow!)
2. Buy a kit with pre-cut pieces (fast!)

**Crouton is the kit.** It automatically creates:
- Forms for creating/editing things
- Tables for viewing lists
- Buttons for saving/deleting
- Database connections
- All the boring stuff!

You just tell Crouton "I need these 4 boxes" and it builds them for you:
1. **Discussions** - Store conversations (with embedded thread data as JSON)
2. **Source Configs** - Settings for each tool (Figma, Slack)
3. **Sync Jobs** - Track what's happening
4. **Tasks** - Remember what was created

**Note**: We keep it simple by:
- Embedding thread data directly in discussions (no separate threads table)
- Hardcoding source types in code (no separate sources table)

## What's SuperSaaS?

SuperSaaS is like having different classrooms:
- Each team has their own classroom
- Each classroom has its own students (team members)
- Each classroom has its own bulletin board (Notion database)
- Students can only see their own classroom's stuff

This means:
- Team A can't see Team B's tasks
- Each team has their own settings
- Each team can use different Notion databases

## The Journey (How We'll Build It)

### Week 1-2: Build the Foundation
Like building the floor and walls of a house
- Set up the Crouton collections
- Port the AI brain from figno
- Create the processing machine

### Week 2-3: Add Figma
Like adding the first room
- Make the Figma adapter
- Connect email notifications
- Test: Figma → AI → Notion

### Week 3-4: Add Slack
Like adding the second room
- Make the Slack adapter
- Connect Slack webhooks
- Test: Slack → AI → Notion

### Week 4-5: Make It Pretty
Like decorating the house
- Build the dashboard
- Add monitoring screens
- Show status and history

### Week 5-6: Make It Safe
Like adding locks and alarms
- Encrypt API secrets
- Add error handling
- Test everything thoroughly

## Key Concepts (Simplified)

### Webhook
Like a doorbell - when something happens in Figma or Slack, it "rings the doorbell" to tell Discubot

### API Token
Like a key - you need the right key to unlock Figma, Slack, and Notion

### Encryption
Like a secret code - we scramble the keys so bad guys can't steal them

### Job Queue
Like a to-do list for the robot - it does one thing at a time so it doesn't get confused

### Adapter
Like a translator - translates between different languages (Figma-speak, Slack-speak) into one common language

## What You Can Do With It

Once Discubot is built, teams can:

1. **In Figma:**
   - Comment: "@DiscubotAI summarize this discussion"
   - Bot creates a task in Notion with the summary
   - Bot replies with a link to the task

2. **In Slack:**
   - Thread: "@DiscubotAI make this a task"
   - Bot reads the whole thread
   - Bot creates task in Notion
   - Bot replies in the thread

3. **Future possibilities:**
   - Discord threads → Notion
   - Microsoft Teams → Notion
   - Linear comments → Notion
   - GitHub PR discussions → Notion

## Why This Matters

### For Teams:
- Never lose track of important discussions
- Turn conversations into actions automatically
- Keep everything organized in Notion
- Save hours of manual copy-pasting

### For You (The Developer):
- Build once, use for many sources
- Easy to maintain and update
- Quick to add new features
- Clean, organized code

### For Users:
- Just mention the bot - that's it!
- Get instant confirmation
- See tasks appear in Notion
- Know nothing was forgotten

## Success Looks Like...

A designer in Figma says:
> "@DiscubotAI The login button needs to be bigger and blue"

30 seconds later:
- ✅ Task appears in Notion: "Make login button bigger and blue"
- ✅ Designer gets Figma reply: "Task created! [Link]"
- ✅ Team sees it in their Notion board
- ✅ Developer picks it up and fixes it

**Everyone is happy!**

## The Bottom Line

Discubot is like hiring a super-efficient assistant who:
- Never sleeps
- Never forgets
- Understands context
- Works in multiple apps
- Costs almost nothing to run

And you're building it in a way that makes it easy to grow and improve over time.

---

**Ready to dive deeper?** Check out:
- `discubot-architecture-brief.md` - How it's built technically
- `discubot-crouton-schemas.md` - The exact configuration files
- `discubot-implementation-roadmap.md` - Step-by-step building plan
