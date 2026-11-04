# Dice Rolls

Dice Roll loot as it happens. When an item drops for your party or Force with Dice Roll on, the game says who rolled what only in chat, which scrolls away; this keeps it in view.

- **Live card:** while a roll is going, a card on screen with the item, the time left and every roll so far, highest first, yours marked. When it ends, who won it and where you placed, for as long as you choose. Several items at once stack. Drag a card to move it; click it to open the window at that roll; the X hides it.
- **History:** every roll kept, newest first; click one to see every number and who passed.

Item names come from the game's own data, in the eight languages the Global client has (Chinese shows English names for now). Rebuild them with `python tools/dice-rolls/build_items.py --tables <extracted Table folder>`.

Needs A2Tools DPS Meter 2.0.88 or newer (the meter's `lootRoll` event).
