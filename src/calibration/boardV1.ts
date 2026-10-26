import type { CalibrationBoard, Point2 } from "./types";

/**
 * Module grids for tagStandard41h12 ids 0–3 ("b" black, "w" white), copied from the official
 * AprilRobotics/apriltag-imgs PNGs (BSD-2-Clause). Each tag is 9×9 modules; the detector's quad is
 * the inner edge of the black ring, which spans modules 2–7.
 */
const TAG_MODULES: Record<number, readonly string[]> = {
  0: [
    "wwbwwwwbb",
    "bbbbbbbbb",
    "wbwwwwwbb",
    "bbwwwwwbw",
    "bbwbbwwbb",
    "bbwbwbwbw",
    "wbwwwwwbb",
    "bbbbbbbbb",
    "wwbwbbwbb",
  ],
  1: [
    "wwbwwwwbw",
    "bbbbbbbbb",
    "wbwwwwwbb",
    "bbwwwwwbb",
    "wbwbwwwbw",
    "wbwwbwwbb",
    "bbwwwwwbb",
    "wbbbbbbbw",
    "bwbwwwbbw",
  ],
  2: [
    "wwbwwwwbw",
    "wbbbbbbbw",
    "wbwwwwwbw",
    "bbwwwbwbw",
    "bbwwbbwbw",
    "wbwbwwwbw",
    "bbwwwwwbw",
    "bbbbbbbbw",
    "bwbwbwbbb",
  ],
  3: [
    "wwbwwwwwb",
    "wbbbbbbbw",
    "wbwwwwwbw",
    "bbwbbbwbw",
    "wbwwwbwbb",
    "bbwwwwwbw",
    "bbwwwwwbb",
    "wbbbbbbbb",
    "wwbwwbbbw",
  ],
};

const MODULES_PER_TAG = 9;
const QUAD_START_MODULE = 2;
const QUAD_END_MODULE = 7;

export const BOARD_V1 = {
  revision: "board-v1",
  checksum: "PC-B1-100MM",
  family: "tagStandard41h12",
  widthMm: 210,
  heightMm: 148,
  tagSizeMm: 26,
  tags: [
    { id: 0, xMm: 10, yMm: 10 },
    { id: 1, xMm: 174, yMm: 10 },
    { id: 2, xMm: 10, yMm: 112 },
    { id: 3, xMm: 174, yMm: 112 },
  ],
  referenceLine: { x1: 55, x2: 155, y: 110, lengthMm: 100 },
  calibration: {
    revision: "board-v1",
    supportedRevision: "board-v1",
    wheelBaseline: [
      { x: 45, y: 120 },
      { x: 165, y: 120 },
    ],
    wheelCenterlineXmm: 105,
    markerPlaneOffsetToleranceMm: 30,
  } satisfies CalibrationBoard,
} as const;

/**
 * Board coordinates (mm, y down) of a tag's detected corners in AprilTag order: bottom-left,
 * bottom-right, top-right, top-left. Returns null for ids that are not on this board.
 */
export function tagCornersMm(id: number): [Point2, Point2, Point2, Point2] | null {
  const tag = BOARD_V1.tags.find((candidate) => candidate.id === id);
  if (!tag) return null;
  const module = BOARD_V1.tagSizeMm / MODULES_PER_TAG;
  const left = tag.xMm + QUAD_START_MODULE * module;
  const right = tag.xMm + QUAD_END_MODULE * module;
  const top = tag.yMm + QUAD_START_MODULE * module;
  const bottom = tag.yMm + QUAD_END_MODULE * module;
  return [
    { x: left, y: bottom },
    { x: right, y: bottom },
    { x: right, y: top },
    { x: left, y: top },
  ];
}

/** Renders the printable board. `public/calibration/board-v1.svg` must equal this output. */
export function renderBoardV1Svg(): string {
  const board = BOARD_V1;
  const module = board.tagSizeMm / MODULES_PER_TAG;
  const round = (value: number) => Number(value.toFixed(4));
  const tags = board.tags.map((tag) => {
    const cells = TAG_MODULES[tag.id]!.flatMap((row, y) =>
      [...row].flatMap((cell, x) =>
        cell === "b"
          ? [
              `<rect x="${round(tag.xMm + x * module)}" y="${round(tag.yMm + y * module)}" width="${round(module)}" height="${round(module)}"/>`,
            ]
          : [],
      ),
    );
    return `    <g data-tag-id="${tag.id}" data-family="${board.family}">${cells.join("")}</g>`;
  });
  const labels = board.tags.map((tag) => {
    const below = tag.yMm < board.heightMm / 2;
    const y = below ? tag.yMm + board.tagSizeMm + 4 : tag.yMm - 2;
    return `<text x="${tag.xMm + board.tagSizeMm / 2}" y="${y}">41h12:${tag.id}</text>`;
  });
  const { x1, x2, y } = board.referenceLine;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${board.widthMm}mm" height="${board.heightMm}mm" viewBox="0 0 ${board.widthMm} ${board.heightMm}" data-revision="${board.revision}" data-checksum="${board.checksum}">
  <rect width="${board.widthMm}" height="${board.heightMm}" fill="white"/>
  <g fill="#000" shape-rendering="crispEdges">
${tags.join("\n")}
  </g>
  <g fill="#111" font-family="monospace" font-size="3" text-anchor="middle">
    ${labels.join("")}
  </g>
  <g stroke="#111" fill="none">
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke-width="0.6" data-reference-mm="${board.referenceLine.lengthMm}"/>
    <line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}"/><line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}"/>
    <line x1="45" y1="120" x2="165" y2="120" stroke-width="0.5" data-wheel-baseline="true"/>
    <line x1="105" y1="42" x2="105" y2="132" stroke-width="0.35" stroke-dasharray="2 2" data-vertical-axis="true"/>
    <circle cx="105" cy="74" r="5" stroke-width="0.7" data-wheel-center="true"/>
    <line x1="97" y1="74" x2="113" y2="74" stroke-width="0.5"/><line x1="105" y1="66" x2="105" y2="82" stroke-width="0.5"/>
    <path d="M105 2v7 M105 139v7 M2 74h7 M201 74h7" stroke-width="0.8" data-centering-guides="true"/>
  </g>
  <g font-family="sans-serif" fill="#111" text-anchor="middle">
    <text x="105" y="55" font-size="8" font-weight="bold">POTTERY COACH CALIBRATION</text>
    <text x="105" y="61" font-size="4.5">Print at 100% — do not fit to page</text>
    <text x="105" y="87" font-size="3.6">Place flat. Align the center target with the wheel axle.</text>
    <text x="105" y="92" font-size="3.6">Keep the page visible. Do not move the phone afterward.</text>
    <text x="105" y="97" font-size="3.6">Verify the line below measures exactly 100 mm</text>
    <text x="105" y="104" font-size="4">100 mm</text>
    <text x="105" y="145" font-size="3.5">${board.revision} · ${board.checksum} · ${board.family}</text>
  </g>
</svg>
`;
}
