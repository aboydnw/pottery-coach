import { writeFile } from "node:fs/promises";
import { renderBoardV1Svg } from "../src/calibration/boardV1";

await writeFile(new URL("../public/calibration/board-v1.svg", import.meta.url), renderBoardV1Svg());
console.log("Wrote public/calibration/board-v1.svg");
