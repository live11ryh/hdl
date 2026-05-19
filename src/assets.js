(function () {
  const sources = {
    contraStyle: {
      local: "assets/images/contra_clone_character_sprite_sheet.png",
      remote: "https://opengameart.org/sites/default/files/contra_clone_character_sprite_sheet.png",
      credit: '"Contra Style Character" by Diogenes99, CC0',
    },
    spaceSoldier: {
      local: "assets/images/all_sprites.png",
      remote: "https://opengameart.org/sites/default/files/all_sprites.png",
      credit: '"Space soldier (sprite sheet 32x32)" by drakzlin, CC0',
    },
    grassTiles: {
      local: "assets/images/grass_dead_grass_spritesheet.png",
      remote: "https://lpc.opengameart.org/sites/default/files/Spritesheet.png",
      credit: '"Grass/Dead Grass Platformer Tileset" by PROWNE, CC0',
    },
    player: {
      local: "assets/images/fierce_soldier_main.png",
      remote: "https://opengameart.org/sites/default/files/fierce_soldier_sprites_-_main_character.png",
      credit: '"Fierce Soldier sprites" by Vircon32 (Carra), CC-BY 4.0',
    },
    enemies: {
      local: "assets/images/fierce_soldier_enemies_bosses.png",
      remote: "https://opengameart.org/sites/default/files/fierce_soldier_sprites_-_enemies_and_bosses.png",
      credit: '"Fierce Soldier sprites" by Vircon32 (Carra), CC-BY 4.0',
    },
    scenery: {
      local: "assets/images/fierce_soldier_scenery_gui.png",
      remote: "https://opengameart.org/sites/default/files/fierce_soldier_sprites_-_scenery_and_gui.png",
      credit: '"Fierce Soldier sprites" by Vircon32 (Carra), CC-BY 4.0',
    },
    forestBack: {
      local: "assets/images/forest_back.png",
      remote: "https://opengameart.org/sites/default/files/Back_0.png",
      credit: '"Forest Parallax" by Robotrage, CC0 / public domain',
    },
    forestMiddle: {
      local: "assets/images/forest_middle.png",
      remote: "https://opengameart.org/sites/default/files/middle.png",
      credit: '"Forest Parallax" by Robotrage, CC0 / public domain',
    },
    forestFront: {
      local: "assets/images/forest_front.png",
      remote: "https://opengameart.org/sites/default/files/front_1.png",
      credit: '"Forest Parallax" by Robotrage, CC0 / public domain',
    },
  };

  function loadImagePair(key, entry) {
    return new Promise((resolve) => {
      const img = new Image();
      let triedRemote = false;

      function fail() {
        if (!triedRemote) {
          triedRemote = true;
          img.src = entry.remote;
          return;
        }
        resolve({ key, image: null, fallback: true });
      }

      img.onload = () => resolve({ key, image: img, fallback: false });
      img.onerror = fail;
      img.src = entry.local;
    });
  }

  async function loadAssets() {
    const loaded = {};
    const pairs = await Promise.all(
      Object.entries(sources).map(([key, entry]) => loadImagePair(key, entry)),
    );
    for (const pair of pairs) {
      loaded[pair.key] = pair;
    }
    return { sources, images: loaded };
  }

  window.HDLAssets = { sources, loadAssets };
})();
