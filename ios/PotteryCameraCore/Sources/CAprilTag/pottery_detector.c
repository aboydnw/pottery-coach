#include "include/pottery_detector.h"
#include "apriltag.h"
#include "tagStandard41h12.h"
#include <stdlib.h>
#include <string.h>

struct pc_detector { apriltag_detector_t *detector; apriltag_family_t *family; };
pc_detector *pc_detector_create(void) {
    pc_detector *value = calloc(1, sizeof(pc_detector));
    if (!value) return NULL;
    value->family = tagStandard41h12_create();
    value->detector = apriltag_detector_create();
    if (!value->family || !value->detector) { pc_detector_destroy(value); return NULL; }
    apriltag_detector_add_family_bits(value->detector, value->family, 0);
    value->detector->nthreads = 1;
    value->detector->quad_decimate = 1.0;
    return value;
}
void pc_detector_destroy(pc_detector *value) {
    if (!value) return;
    if (value->detector) apriltag_detector_destroy(value->detector);
    if (value->family) tagStandard41h12_destroy(value->family);
    free(value);
}
int pc_detector_detect(pc_detector *value, const uint8_t *pixels, int width, int height, int stride, pc_tag *output, int capacity) {
    if (!value || !pixels || !output || width <= 0 || height <= 0 || stride < width || capacity <= 0) return -1;
    image_u8_t image = { .width = width, .height = height, .stride = stride, .buf = (uint8_t *)pixels };
    zarray_t *detections = apriltag_detector_detect(value->detector, &image);
    int count = 0;
    for (int i = 0; i < zarray_size(detections); i++) {
        apriltag_detection_t *tag;
        zarray_get(detections, i, &tag);
        if (count >= capacity) { count = -1; break; }
        output[count].id = tag->id;
        output[count].hamming = tag->hamming;
        output[count].margin = tag->decision_margin;
        for (int j = 0; j < 4; j++) { output[count].x[j] = tag->p[j][0]; output[count].y[j] = tag->p[j][1]; }
        count++;
    }
    apriltag_detections_destroy(detections);
    return count;
}
int pc_render_test_tag(int id, uint8_t *pixels, int width, int height) {
    if (!pixels || id < 0 || id > 3 || width < 100 || height < 100) return 0;
    apriltag_family_t *family = tagStandard41h12_create();
    image_u8_t *tag = apriltag_to_image(family, id);
    memset(pixels, 255, (size_t)width * height);
    const int scale = (width < height ? width : height) / (tag->width + 8);
    const int left = (width - scale * tag->width) / 2;
    const int top = (height - scale * tag->height) / 2;
    for (int y = 0; y < tag->height; y++) for (int x = 0; x < tag->width; x++)
        for (int dy = 0; dy < scale; dy++) for (int dx = 0; dx < scale; dx++)
            pixels[(top + y * scale + dy) * width + left + x * scale + dx] = tag->buf[y * tag->stride + x];
    image_u8_destroy(tag);
    tagStandard41h12_destroy(family);
    return 1;
}
