import React, { useEffect, useMemo, useState } from "react";

export default function KpiCounter({ value = 0, duration = 500, suffix = "" }) {
  const target = useMemo(() => Number(value || 0), [value]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return <span>{shown}{suffix}</span>;
}
