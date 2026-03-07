import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ThermalPreviewProps {
  lines: ThermalLine[];
}

export interface ThermalLine {
  text: string;
  bold?: boolean;
  center?: boolean;
  large?: boolean;
  separator?: boolean;
  dotSeparator?: boolean;
}

const ThermalPreview: React.FC<ThermalPreviewProps> = ({ lines }) => {
  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="flex justify-center py-3">
        <div
          className="bg-white text-black rounded shadow-lg border"
          style={{
            width: '190px', // simulate ~48mm
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '10px',
            lineHeight: '1.4',
            padding: '10px 6px',
          }}
        >
          {lines.map((line, i) => {
            if (line.separator) {
              return (
                <div key={i} style={{ textAlign: 'center', letterSpacing: '1px', color: '#666' }}>
                  {'─'.repeat(32)}
                </div>
              );
            }
            if (line.dotSeparator) {
              return (
                <div key={i} style={{ textAlign: 'center', color: '#999', letterSpacing: '1px' }}>
                  {'·'.repeat(32)}
                </div>
              );
            }
            return (
              <div
                key={i}
                style={{
                  fontWeight: line.bold ? 'bold' : 'normal',
                  textAlign: line.center ? 'center' : 'left',
                  fontSize: line.large ? '13px' : '10px',
                  whiteSpace: 'pre',
                  overflow: 'hidden',
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
};

export default ThermalPreview;
