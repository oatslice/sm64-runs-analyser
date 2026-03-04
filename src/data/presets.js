/**
 * presets.js
 *
 * Preset collection templates, grouped by speedrun category.
 *
 * STRUCTURE:
 *   PRESET_CATEGORIES is an array of category groups, each with:
 *     - id:      unique slug
 *     - label:   display name (e.g. "120 Star")
 *     - presets: array of preset collections for that category
 *
 *   Each preset has:
 *     - id:     unique slug
 *     - label:  collection name that will be created
 *     - stars:  array of { stage, star, strategy }
 *
 * HOW TO EDIT:
 *   - Add/remove presets within a category freely.
 *   - Add a new category by appending to PRESET_CATEGORIES.
 *   - stage/star strings must match exactly what's in stars_catalogue.json.
 *   - strategy defaults to 'Standard' â€” change to any strategy in the catalogue.
 *
 * The presets here are starting points. Users can modify collections after creation.
 */

export const PRESET_CATEGORIES = [
  // â”€â”€ 120 Star â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: '120',
    label: '120 Star',
    presets: [
      {
        id: 'bob',
        label: 'Bob-omb Battlefield',
        stars: [
          { stage: '1. Bob-omb Battlefield', star: 'Big Bob-omb on the Summit',     strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Footrace with Koopa the Quick',  strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Shoot to the Island in the Sky', strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Find the 8 Red Coins + 100c',    strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Mario Wings to the Sky',          strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: "Behind Chain Chomp's Gate",       strategy: 'Standard' },
        ],
      },
      {
        id: 'wf',
        label: "Whomp's Fortress",
        stars: [
          { stage: "2. Whomp's Fortress", star: "Chip off Whomp's Block",          strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'To the Top of the Fortress',      strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Shoot into the Wild Blue',        strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Red Coins on the Floating Isle + 100c', strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Fall onto the Caged Island',      strategy: 'Standard' },
          { stage: "2. Whomp's Fortress", star: 'Blast Away the Wall',             strategy: 'Standard' },
        ],
      },
      {
        id: 'jrb',
        label: 'Jolly Roger Bay',
        stars: [
          { stage: '3. Jolly Roger Bay', star: 'Plunder in the Sunken Ship',        strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Can the Eel Come Out to Play?',     strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Treasure of the Ocean Cave',        strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Red Coins on the Ship Afloat + 100c', strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Blast to the Stone Pillar',         strategy: 'Standard' },
          { stage: '3. Jolly Roger Bay', star: 'Through the Jet Stream',            strategy: 'Standard' },
        ],
      },
      {
        id: 'ccm',
        label: 'Cool, Cool Mountain',
        stars: [
          { stage: "4. Cool, Cool Mountain", star: "Slip Slidin' Away",              strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: "Li'l Penguin Lost",              strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: 'Big Penguin Race + 100c',        strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: 'Frosty Slide for 8 Red Coins',   strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: "Snowman's Lost His Head",        strategy: 'Standard' },
          { stage: "4. Cool, Cool Mountain", star: 'Wall Kicks Will Work',           strategy: 'Standard' },
        ],
      },
      {
        id: 'bbh',
        label: "Big Boo's Haunt",
        stars: [
          { stage: "5. Big Boo's Haunt", star: 'Go on a Ghost Hunt',                strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: "Ride Big Boo's Merry-Go-Round",     strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: 'Secret of the Haunted Books',       strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: 'Seek the 8 Red Coins + 100c',       strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: "Big Boo's Balcony",                  strategy: 'Standard' },
          { stage: "5. Big Boo's Haunt", star: 'Eye to Eye in the Secret Room',     strategy: 'Standard' },
        ],
      },
      {
        id: 'hmc',
        label: 'Hazy Maze Cave',
        stars: [
          { stage: '6. Hazy Maze Cave', star: 'Swimming Beast in the Cavern',       strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Elevate for 8 Red Coins + 100c',     strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Metal-Head Mario Can Move!',          strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Navigating the Toxic Maze',          strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'A-Maze-ing Emergency Exit',          strategy: 'Standard' },
          { stage: '6. Hazy Maze Cave', star: 'Watch for Rolling Rocks',            strategy: 'Standard' },
        ],
      },
      {
        id: 'lll',
        label: 'Lethal Lava Land',
        stars: [
          { stage: '7. Lethal Lava Land', star: 'Boil the Big Bully',               strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Bully the Bullies',                strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: '8-Coin Puzzle with 15 Pieces',     strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Red-Hot Log Rolling',              strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Hot-Foot-It into the Volcano',     strategy: 'Standard' },
          { stage: '7. Lethal Lava Land', star: 'Elevator Tour in the Volcano',     strategy: 'Standard' },
        ],
      },
      {
        id: 'ssl',
        label: 'Shifting Sand Land',
        stars: [
          { stage: '8. Shifting Sand Land', star: 'In the Talons of the Big Bird',  strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Shining atop the Pyramid',       strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Inside the Ancient Pyramid',     strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Stand Tall on the Four Pillars', strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Free Flying for 8 Red Coins',    strategy: 'Standard' },
          { stage: '8. Shifting Sand Land', star: 'Pyramid Puzzle',                 strategy: 'Standard' },
        ],
      },
      {
        id: 'ddd',
        label: 'Dire, Dire Docks',
        stars: [
          { stage: '9. Dire, Dire Docks', star: "Board Bowser's Sub",               strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Chests in the Current',            strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Pole-Jumping for Red Coins + 100c', strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Through the Jet Stream',           strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: "The Manta Ray's Reward",           strategy: 'Standard' },
          { stage: '9. Dire, Dire Docks', star: 'Collect the Caps...',              strategy: 'Standard' },
        ],
      },
      {
        id: 'sl',
        label: "Snowman's Land",
        stars: [
          { stage: "10. Snowman's Land", star: "Snowman's Big Head",                strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'Chill with the Bully',              strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'In the Deep Freeze',                strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'Whirl from the Freezing Pond',      strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: "Shell Shreddin' for Red Coins",     strategy: 'Standard' },
          { stage: "10. Snowman's Land", star: 'Into the Igloo',                    strategy: 'Standard' },
        ],
      },
      {
        id: 'wdw',
        label: 'Wet-Dry World',
        stars: [
          { stage: '11. Wet-Dry World', star: 'Shocking Arrow Lifts!',              strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: "Top o' the Town",                    strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Secrets in the Shallows & Sky',      strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Express Elevator--Hurry Up!',        strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Go to Town for Red Coins + 100c',    strategy: 'Standard' },
          { stage: '11. Wet-Dry World', star: 'Quick Race Through Downtown!',       strategy: 'Standard' },
        ],
      },
      {
        id: 'ttm',
        label: 'Tall, Tall Mountain',
        stars: [
          { stage: '12. Tall, Tall Mountain', star: 'Scale the Mountain',           strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Mystery of the Monkey Cage',   strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: "Scary 'Shrooms, Red Coins",    strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Mysterious Mountainside',      strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Breathtaking View from Bridge', strategy: 'Standard' },
          { stage: '12. Tall, Tall Mountain', star: 'Blast to the Lonely Mushroom', strategy: 'Standard' },
        ],
      },
      {
        id: 'thi',
        label: 'Tiny-Huge Island',
        stars: [
          { stage: '13. Tiny-Huge Island', star: 'Pluck the Piranha Flower',        strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'The Tip Top of the Huge Island',  strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'Rematch with Koopa the Quick',    strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'Five Itty Bitty Secrets',         strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: "Wiggler's Red Coins",             strategy: 'Standard' },
          { stage: '13. Tiny-Huge Island', star: 'Make Wiggler Squirm',             strategy: 'Standard' },
        ],
      },
      {
        id: 'ttc',
        label: 'Tick Tock Clock',
        stars: [
          { stage: '14. Tick Tock Clock', star: 'Roll into the Cage',               strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'The Pit and the Pendulums',        strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Get a Hand',                       strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Stomp on the Thwomp',              strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Timed Jumps on Moving Bars',       strategy: 'Standard' },
          { stage: '14. Tick Tock Clock', star: 'Stop Time for Red Coins',          strategy: 'Standard' },
        ],
      },
      {
        id: 'rr',
        label: 'Rainbow Ride',
        stars: [
          { stage: '15. Rainbow Ride', star: 'Cruiser Crossing the Rainbow',        strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'The Big House in the Sky (PAUSE TIME INCLUDED)', strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'Coins Amassed in a Maze',             strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: "Swingin' in the Breeze",              strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'Tricky Triangles!',                   strategy: 'Standard' },
          { stage: '15. Rainbow Ride', star: 'Somewhere over the Rainbow',          strategy: 'Standard' },
        ],
      },
      {
        id: 'castle',
        label: 'Castle Secret Stars',
        stars: [
          { stage: 'Castle Secret Stars', star: 'Tower of the Wing Cap',            strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'Vanish Cap under the Moat',        strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'Cavern of the Metal Cap',          strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'The Secret Aquarium',              strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: 'Wing Mario over the Rainbow',      strategy: 'Standard' },
          { stage: 'Castle Secret Stars', star: "The Princess's Secret Slide",      strategy: 'Standard' },
        ],
      },
      {
        id: 'bowser_120',
        label: 'Bowser Courses',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Course',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Red Coins',    strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Battle',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Course',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Red Coins',      strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Battle',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // â”€â”€ 70 Star â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Edit these to match the segments/stars used in your 70-star route.
  {
    id: '70',
    label: '70 Star',
    presets: [
      {
        id: '70_bob',
        label: '70s BoB',
        stars: [
          { stage: '1. Bob-omb Battlefield', star: 'Big Bob-omb on the Summit',     strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Footrace with Koopa the Quick',  strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Shoot to the Island in the Sky', strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Find the 8 Red Coins + 100c',    strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: 'Mario Wings to the Sky',          strategy: 'Standard' },
          { stage: '1. Bob-omb Battlefield', star: "Behind Chain Chomp's Gate",       strategy: 'Standard' },
        ],
      },
      {
        id: '70_bowser',
        label: '70s Bowser fights',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Battle',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Battle',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // â”€â”€ 16 Star â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Covers the stars typically obtained in a 16-star run.
  // Adjust to your preferred route order.
  {
    id: '16',
    label: '16 Star',
    presets: [
      {
        id: '16_bitdw',
        label: '16s BitDW',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Course',       strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Dark World Battle',       strategy: 'Standard' },
        ],
      },
      {
        id: '16_bitfs',
        label: '16s BitFS',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Course',         strategy: 'Standard' },
          { stage: 'Bowser Courses', star: 'Bowser in the Fire Sea Battle',         strategy: 'Standard' },
        ],
      },
      {
        id: '16_bits',
        label: '16s BitS',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // â”€â”€ 1 Star â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: '1',
    label: '1 Star',
    presets: [
      {
        id: '1_bits',
        label: '1s BitS',
        stars: [
          { stage: 'Bowser Courses', star: 'Bowser in the Sky Course',              strategy: 'Standard' },
        ],
      },
    ],
  },

  // â”€â”€ 0 Star â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: '0',
    label: '0 Star',
    presets: [
      // 0 star does not collect any stars â€” add timing segments here if useful,
      // e.g. individual movement sections you want to track.
      // { id: '0_example', label: 'Example segment', stars: [] },
    ],
  },
]
