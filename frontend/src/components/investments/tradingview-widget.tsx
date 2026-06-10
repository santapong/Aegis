"use client";

import { memo, useEffect, useRef, useState } from "react";

interface TradingViewWidgetProps {
  symbol: string;
  height?: number;
}

/**
 * Embeds TradingView's free Symbol Overview widget. The script tag must be
 * a direct child of an empty container, and the widget config is encoded
 * inside it as JSON — that's how TradingView's loader discovers it.
 *
 * Each embed fetches TradingView's loader plus chart data, so eagerly
 * mounting one per holding cost O(holdings) network + script-execute up
 * front. The IntersectionObserver defers each embed until its card
 * scrolls near the viewport, and memo() keeps parent re-renders (modals,
 * form state) from re-injecting already-mounted widgets.
 *
 * Re-mounts only when `symbol` or `height` change. The widget always
 * uses dark mode since all Aegis cosmic themes share a dark surface.
 */
export const TradingViewWidget = memo(function TradingViewWidget({
  symbol,
  height = 220,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visible) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[symbol, symbol]],
      chartOnly: false,
      width: "100%",
      height,
      locale: "en",
      colorTheme: "dark",
      isTransparent: true,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "system-ui, sans-serif",
      fontSize: "10",
      noTimeScale: false,
      valuesTracking: "1",
      changeMode: "price-and-percent",
      lineWidth: 2,
      lineType: 0,
      dateRanges: ["1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, height, visible]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height, width: "100%" }}
    />
  );
});
