import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from './theme.ts';

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)] as const;
}

/** Points bruts (pesées) + ligne de tendance lissée. */
export function TrendChart({ points, height = 180 }: {
  points: { label: string; raw?: number; trend: number }[]; height?: number;
}) {
  const t = useTheme();
  const [width, onLayout] = useWidth();
  if (points.length < 2) return <View style={{ height }} onLayout={onLayout} />;
  const pad = { l: 34, r: 8, t: 8, b: 18 };
  const vals = points.flatMap((p) => (p.raw !== undefined ? [p.raw, p.trend] : [p.trend]));
  const min = Math.floor(Math.min(...vals) - 0.3);
  const max = Math.ceil(Math.max(...vals) + 0.3);
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (width - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join(' ');
  const ticks = [min, (min + max) / 2, max];
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((v) => (
            <Line key={v} x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke={t.border} strokeWidth={1} />
          ))}
          {ticks.map((v) => (
            <SvgText key={`l${v}`} x={pad.l - 4} y={y(v) + 4} fontSize={10} fill={t.muted} textAnchor="end">
              {v.toFixed(1)}
            </SvgText>
          ))}
          {points.map((p, i) =>
            p.raw !== undefined ? <Circle key={i} cx={x(i)} cy={y(p.raw)} r={2.5} fill={t.raw} /> : null,
          )}
          <Path d={path} stroke={t.trend} strokeWidth={2.5} fill="none" />
          <SvgText x={pad.l} y={height - 4} fontSize={10} fill={t.muted}>{points[0].label}</SvgText>
          <SvgText x={width - pad.r} y={height - 4} fontSize={10} fill={t.muted} textAnchor="end">
            {points[points.length - 1].label}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

/** Barres avec ligne d'objectif optionnelle. */
export function BarChart({ bars, target, height = 150, color }: {
  bars: { label: string; value: number }[]; target?: number; height?: number; color?: string;
}) {
  const t = useTheme();
  const [width, onLayout] = useWidth();
  const pad = { l: 4, r: 4, t: 8, b: 18 };
  const max = Math.max(1, target ?? 0, ...bars.map((b) => b.value)) * 1.1;
  const slot = bars.length ? (width - pad.l - pad.r) / bars.length : 0;
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {bars.map((b, i) => (
            <Rect
              key={i}
              x={pad.l + i * slot + slot * 0.15}
              y={y(b.value)}
              width={slot * 0.7}
              height={Math.max(0, height - pad.b - y(b.value))}
              rx={3}
              fill={color ?? t.accent}
              opacity={b.value > 0 ? 1 : 0.2}
            />
          ))}
          {bars.map((b, i) => (
            <SvgText key={`t${i}`} x={pad.l + i * slot + slot / 2} y={height - 4} fontSize={9} fill={t.muted} textAnchor="middle">
              {b.label}
            </SvgText>
          ))}
          {target !== undefined && (
            <Line x1={pad.l} x2={width - pad.r} y1={y(target)} y2={y(target)} stroke={t.warn} strokeWidth={1.5} strokeDasharray="5,4" />
          )}
        </Svg>
      )}
    </View>
  );
}
