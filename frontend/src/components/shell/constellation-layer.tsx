"use client";

/**
 * ConstellationLayer — hand-placed star points connected by hairline gold
 * lines, evoking a star-chart. Only rendered when theme === 'constellation'.
 */
export function ConstellationLayer() {
  const stars: Array<[number, number]> = [
    [12, 18], [22, 24], [34, 14], [48, 22], [60, 16], [72, 28], [86, 20], [92, 38],
    [8, 42], [20, 50], [38, 44], [54, 58], [68, 48], [82, 60], [94, 70],
    [14, 70], [28, 78], [42, 84], [58, 76], [70, 88], [84, 82], [96, 90],
  ];
  const lines: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7],
    [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14],
    [15, 16], [16, 17], [17, 18], [18, 19], [19, 20], [20, 21],
    [0, 8], [3, 11], [7, 14], [9, 16], [12, 19],
  ];

  return (
    <svg className="bd-constellation" viewBox="0 0 100 100" preserveAspectRatio="none">
      {lines.map(([a, b], i) => {
        const [x1, y1] = stars[a];
        const [x2, y2] = stars[b];
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.55} />
      ))}
    </svg>
  );
}
