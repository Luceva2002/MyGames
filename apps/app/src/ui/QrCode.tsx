import { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import qrcode from 'qrcode-generator';

/** QR tutto bianco, senza riquadro: va messo su un fondo scuro. */
export function QrCode({ value, size }: { value: string; size: number }) {
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
    <Svg width={size} height={size} viewBox={`${-pad} ${-pad} ${count + pad * 2} ${count + pad * 2}`} accessibilityLabel="QR per entrare nella stanza">
      <Path d={path} fill="#fff" />
    </Svg>
  );
}
