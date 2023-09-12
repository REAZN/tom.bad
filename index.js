import fetch from "node-fetch";
import Jimp from "jimp";
import throttledQueue from "throttled-queue";
import nearestColor from "nearest-color";

///////////////////////
const token = "<TOKEN>";
const imageSrc = "<IMAGE.png|jpg|etc>";
///////////////////////

const queue = throttledQueue(15, 100);

async function getBoardInfo() {
  try {
    const res = await fetch("https://artboard-api.tomdotbat.dev/boards/active");

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    throw new Error(`Error: ${res.status}`);
  }
}

const board = await getBoardInfo();

const colorMatch = nearestColor.from(
  board.palette.colors.reduce((acc, cv, i) => {
    acc[i] = cv;
    return acc;
  }, {})
);

function loadImageAndProcess() {
  try {
    Jimp.read(imageSrc, (err, image) => {
      if (err) {
        throw err;
      }
      image.resize(board.width, board.height);
      image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, _) => {
        const pixelColor = Jimp.intToRGBA(image.getPixelColor(x, y));
        const color = `rgb(${pixelColor.r}, ${pixelColor.g}, ${pixelColor.b})`;

        const closestColor = colorMatch(color);
        image.setPixelColor(Jimp.cssColorToHex(closestColor.value), x, y);

        updatePixel(x, y, closestColor.name);
      });
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

let progress = 0;

function printProgress() {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`${progress}/${board.width * board.height}`);
}

function updatePixel(x, y, color) {
  const url = `https://artboard-api.tomdotbat.dev/boards/active/pixels/${x}/${y}`;

  const options = {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      color_id: Math.min(Math.max(color, 0), board.palette.colors.length),
    }),
  };

  queue(() => {
    fetch(url, options)
      .then((res) => {
        progress++;
        printProgress(color);
        if (!res.ok) {
          throw new Error(`HTTP error: ${res.status}`);
        }
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  });
}

loadImageAndProcess();
