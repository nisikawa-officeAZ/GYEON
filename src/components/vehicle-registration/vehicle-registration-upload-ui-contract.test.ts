import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./VehicleRegistrationUpload.tsx", import.meta.url), "utf8");

test("photo selection is the primary OCR source and the camera never auto-starts", () => {
  const photoAction = source.indexOf("写真から選択</p>");
  const cameraAction = source.indexOf("カメラで撮影</span>");

  assert.ok(photoAction >= 0, "photo selection action must be present");
  assert.ok(cameraAction > photoAction, "photo selection must be rendered before the camera action");
  assert.doesNotMatch(source, /attempt the webcam immediately/);
  assert.doesNotMatch(source, /authStatus === "ok"[\s\S]{0,180}startWebcam\(\)/);
});

test("camera action buttons use one icon box and one button height", () => {
  const cameraStage = source.match(/\{\/\* ── Stage: camera[\s\S]*?\{\/\* ── Stage: compressing/)?.[0] ?? "";

  assert.equal((cameraStage.match(/h-12 min-w-0/g) ?? []).length, 3);
  assert.equal((cameraStage.match(/inline-flex size-6 items-center justify-center text-xl leading-none/g) ?? []).length, 3);
  for (const label of ["撮影する", "写真から選択", "キャンセル"]) {
    assert.match(cameraStage, new RegExp(label));
  }
});
