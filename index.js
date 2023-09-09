const fs = require("fs");
const googleTTS = require("google-tts-api");
const ffmpeg = require("fluent-ffmpeg");
const { createCanvas } = require("canvas");
const GIFEncoder = require("gif-encoder-2");
const Jimp = require("jimp");

const facts = [
  "Fact 1: This is the first fact.",
  "Fact 2: Here's another interesting fact.",
  // ... Add more facts
];

const createFolder = (folderName) => {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
};

const generateAudioAndVideo = async (fact, index) => {
  const folderName = `fact_${index}`;
  const audioUrl = googleTTS.getAudioUrl(fact, {
    lang: "en",
    slow: false,
    host: "https://translate.google.com",
  });

  createFolder(folderName); // Create a new folder for each fact

  const audioPath = `${folderName}/fact_${index}.mp3`;
  const gifPath = `${folderName}/fact_${index}.gif`;
  const videoPath = `${folderName}/fact_${index}.mp4`;

  const textImagePaths = [];

  // Split the fact into words
  const words = fact.split(" ");

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black"; // Background color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "24px sans-serif"; // Use the default sans-serif font

    // Determine text color based on the current word index
    if (i === 0) {
      ctx.fillStyle = "yellow"; // Highlighted word color
    } else {
      ctx.fillStyle = "white"; // Other words color
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(word, canvas.width / 2, canvas.height / 2);

    const frameImagePath = `${folderName}/frame_${i}.png`;
    await new Promise((resolve) => {
      const out = fs.createWriteStream(frameImagePath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      out.on("finish", resolve);
    });
    textImagePaths.push(frameImagePath);
  }

  const audioResponse = await fetch(audioUrl);
  const audioBuffer = await audioResponse.arrayBuffer();
  fs.writeFileSync(audioPath, Buffer.from(audioBuffer));

  // Create a GIF directly from the text images using jimp
  const gif = new GIFEncoder(1280, 720);
  gif.createReadStream().pipe(fs.createWriteStream(gifPath)); // Create GIF stream
  gif.setRepeat(0); // 0 for repeat, -1 for no-repeat
  gif.setDelay(200); // frame delay in ms
  gif.start();

  for (const frameImagePath of textImagePaths) {
    const frameImage = await Jimp.read(frameImagePath);
    const buffer = frameImage.bitmap.data; // Get the image data as a buffer
    gif.addFrame(buffer);
  }

  gif.finish();

  // Convert the GIF to a video
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(gifPath)
      .input(audioPath)
      .audioCodec("aac") // Specify audio codec
      .audioBitrate("192k") // Specify audio bitrate
      .output(videoPath)
      .on("end", () => {
        console.log(
          `Fact ${index} - Audio and video generated in ${folderName}`
        );
        resolve(videoPath);
      })
      .on("error", (err) => {
        console.error(
          `Fact ${index} - Error generating audio and video: ${err}`
        );
        reject(err);
      })
      .run();
  });
};

(async () => {
  for (let i = 0; i < facts.length; i++) {
    const fact = facts[i];
    try {
      const videoPath = await generateAudioAndVideo(fact, i);
      console.log(`Fact ${i} - Video created: ${videoPath}`);
    } catch (error) {
      console.error(error);
    }
  }
})();
