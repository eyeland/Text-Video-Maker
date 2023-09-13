const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const { createCanvas } = require("canvas");
const GIFEncoder = require("gif-encoder-2");
const Jimp = require("jimp");
const gtts = require("node-gtts")("en"); // Replace "en" with your desired language code

const facts = [
  "Fact 1: | Honey never spoils | Archaeologists have found | pots of honey in |ancient Egyptian tombs | that are over | 3,000 years old | and still perfectly | edible.",

  // ... Add more facts
];

const createFolder = (folderName) => {
  if (!fs.existsSync(folderName)) {
    fs.mkdirSync(folderName);
  }
};

const calculateFrameDelay = (words) => {
  // Calculate the frame delay based on the number of words
  const wordsPerSecond = 1.4; // Adjust this value as needed
  const delayPerWord = 1000 / wordsPerSecond;
  return words.length * delayPerWord;
};

const generateAudioAndVideo = async (fact, index) => {
  const folderName = `fact_${index}`;

  createFolder(folderName); // Create a new folder for each fact

  const audioPath = `${folderName}/fact_${index}.mp3`;
  const gifPath = `${folderName}/fact_${index}.gif`;
  const videoPath = `${folderName}/fact_${index}.mp4`;

  const textImagePaths = [];
  const segments = fact.split("|"); // Use "|" as the separator

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();

    const canvas = createCanvas(1280, 720);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black"; // Background color
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "24px sans-serif"; // Use the default sans-serif font

    // Determine text color based on the current segment
    ctx.fillStyle = "yellow"; // Highlighted segment color

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(segment, canvas.width / 2, canvas.height / 2);

    const frameImagePath = `${folderName}/frame_${i}.png`;
    await new Promise((resolve) => {
      const out = fs.createWriteStream(frameImagePath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      out.on("finish", resolve);
    });
    textImagePaths.push(frameImagePath);
  }

  // Use node-gtts to generate audio
  await new Promise((resolve, reject) => {
    const audioStream = gtts.stream(fact);
    const audioFile = fs.createWriteStream(audioPath);
    audioStream.pipe(audioFile);
    audioFile.on("finish", resolve);
    audioFile.on("error", reject);
  });

  // Calculate the frame delay based on the number of words in the first segment
  const firstSegmentWords = segments[0].trim().split(" ");
  const frameDelay = calculateFrameDelay(firstSegmentWords);

  // Create a GIF directly from the text images using jimp
  const gif = new GIFEncoder(1280, 720);
  gif.createReadStream().pipe(fs.createWriteStream(gifPath)); // Create GIF stream
  gif.setRepeat(0); // 0 for repeat, -1 for no-repeat
  gif.setDelay(frameDelay); // Set the frame delay based on word count
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
