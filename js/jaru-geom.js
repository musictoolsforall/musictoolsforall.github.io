// Where to draw a jaru line, given the boxes of its two notes and the
// visual rows the notation has wrapped into. A jaru that crosses a wrap
// is drawn as one segment per row.

const centre = (box) => (box.left + box.right) / 2;

function rowIndex(rows, box) {
  let best = 0;
  for (let i = 0; i < rows.length; i++) {
    if (Math.abs(rows[i].top - box.top) < Math.abs(rows[best].top - box.top)) best = i;
  }
  return best;
}

export function jaruSegments(fromBox, toBox, rowBoxes) {
  const a = rowIndex(rowBoxes, fromBox);
  const b = rowIndex(rowBoxes, toBox);
  if (a === b) return [{ x1: centre(fromBox), x2: centre(toBox), y: rowBoxes[a].top }];
  const segments = [{ x1: centre(fromBox), x2: rowBoxes[a].right, y: rowBoxes[a].top }];
  for (let i = a + 1; i < b; i++) {
    segments.push({ x1: rowBoxes[i].left, x2: rowBoxes[i].right, y: rowBoxes[i].top });
  }
  segments.push({ x1: rowBoxes[b].left, x2: centre(toBox), y: rowBoxes[b].top });
  return segments;
}
