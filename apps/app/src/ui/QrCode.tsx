import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

/** QR: di default nero su bianco; `light` lo disegna bianco su fondo trasparente (per le schede scure). */
export function QrCode({ value, size, light }: { value: string; size: number; light?: boolean }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { path: d, count: n };
  }, [value]);
  const pad = 2;
  return (
    <Svg width={size} height={size} viewBox={`${-pad} ${-pad} ${count + pad * 2} ${count + pad * 2}`}>
      {!light && <Rect x={-pad} y={-pad} width={count + pad * 2} height={count + pad * 2} fill="#fff" />}
      <Path d={path} fill={light ? '#fff' : '#000'} />
    </Svg>
  );
}
