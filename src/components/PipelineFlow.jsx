import React, { useEffect, useState } from 'react';
import { ReactFlow, Background, Position, Handle, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const BLUE = '#3B82F6';
const BLUE_DARK = '#2563EB';
const VIOLET = '#8B5CF6';
const VIOLET_DARK = '#7C3AED';
const NEUTRAL = '#5A5A7A';
const NEUTRAL_DARK = '#3A3A55';

const hs = { background: 'transparent', border: 'none', width: 1, height: 1 };

const AllHandles = () => (
  <>
    <Handle type="source" position={Position.Top} id="top-src" style={hs} />
    <Handle type="target" position={Position.Top} id="top-tgt" style={hs} />
    <Handle type="source" position={Position.Bottom} id="bot-src" style={hs} />
    <Handle type="target" position={Position.Bottom} id="bot-tgt" style={hs} />
    <Handle type="source" position={Position.Left} id="left-src" style={hs} />
    <Handle type="target" position={Position.Left} id="left-tgt" style={hs} />
    <Handle type="source" position={Position.Right} id="right-src" style={hs} />
    <Handle type="target" position={Position.Right} id="right-tgt" style={hs} />
  </>
);

const PipeNode = ({ data }) => (
  <div style={{
    background: data.bg, border: `2px solid ${data.border}`, borderRadius: '10px',
    padding: '12px 18px', minWidth: '120px', textAlign: 'center', color: '#fff',
    fontFamily: "'Geist Mono', monospace", fontSize: '14px',
    boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 15px ${data.border}22`,
  }}>
    <AllHandles />
    <div style={{ fontWeight: 600, fontSize: '15px' }}>{data.label}</div>
  </div>
);

const LabelNode = ({ data }) => (
  <div style={{
    fontFamily: "'Geist Mono', monospace", fontSize: '15px', fontWeight: 700,
    color: data.color || '#ccc', textTransform: 'uppercase', letterSpacing: '0.08em',
    textAlign: 'center', padding: '4px 10px', borderBottom: `2px solid ${data.color || '#555'}`,
  }}>
    {data.label}
  </div>
);

const nodeTypes = { pipe: PipeNode, label: LabelNode };
const arrow = (color) => ({ type: MarkerType.ArrowClosed, color, width: 12, height: 12 });

const COL1 = 0, COL2 = 240, COL3 = 480;

const nodes = [
  // Pipeline labels
  { id: 'lbl-text', type: 'label', position: { x: COL1 + 10, y: 0 }, data: { label: 'TEXT PIPELINE', color: BLUE } },
  { id: 'lbl-image', type: 'label', position: { x: COL2 + 10, y: 0 }, data: { label: 'IMAGE PIPELINE', color: VIOLET } },
  { id: 'lbl-audio', type: 'label', position: { x: COL3 + 10, y: 0 }, data: { label: 'AUDIO PIPELINE', color: BLUE } },

  // Text pipeline: Text Input -> LLM -> TTS -> Audio Output
  { id: 'text-in', type: 'pipe', position: { x: COL1, y: 50 }, data: { label: 'Text Input', bg: BLUE, border: BLUE_DARK } },
  { id: 'llm', type: 'pipe', position: { x: COL1, y: 130 }, data: { label: 'LLM', bg: VIOLET, border: VIOLET_DARK } },
  { id: 'tts', type: 'pipe', position: { x: COL1, y: 210 }, data: { label: 'TTS', bg: VIOLET, border: VIOLET_DARK } },
  { id: 'audio-out', type: 'pipe', position: { x: COL1, y: 290 }, data: { label: 'Audio Output', bg: NEUTRAL, border: NEUTRAL_DARK } },

  // Image pipeline: Image Prompt -> FLUX -> Image Output
  { id: 'img-prompt', type: 'pipe', position: { x: COL2, y: 50 }, data: { label: 'Image Prompt', bg: VIOLET, border: VIOLET_DARK } },
  { id: 'flux', type: 'pipe', position: { x: COL2, y: 170 }, data: { label: 'FLUX', bg: VIOLET, border: VIOLET_DARK } },
  { id: 'img-out', type: 'pipe', position: { x: COL2, y: 290 }, data: { label: 'Image Output', bg: NEUTRAL, border: NEUTRAL_DARK } },

  // Audio pipeline: Audio -> ASR -> Text
  { id: 'audio-in', type: 'pipe', position: { x: COL3, y: 50 }, data: { label: 'Audio Input', bg: BLUE, border: BLUE_DARK } },
  { id: 'asr', type: 'pipe', position: { x: COL3, y: 170 }, data: { label: 'ASR', bg: VIOLET, border: VIOLET_DARK } },
  { id: 'text-out', type: 'pipe', position: { x: COL3, y: 290 }, data: { label: 'Text Output', bg: NEUTRAL, border: NEUTRAL_DARK } },
];

const be = { type: 'smoothstep', animated: true, style: { stroke: BLUE, strokeWidth: 2 } };
const ve = { type: 'smoothstep', animated: true, style: { stroke: VIOLET, strokeWidth: 2 } };

const edges = [
  // Text pipeline
  { id: 'e-t1', source: 'text-in', target: 'llm', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...be, markerEnd: arrow(BLUE) },
  { id: 'e-t2', source: 'llm', target: 'tts', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...ve, markerEnd: arrow(VIOLET) },
  { id: 'e-t3', source: 'tts', target: 'audio-out', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...ve, markerEnd: arrow(VIOLET) },

  // Image pipeline
  { id: 'e-i1', source: 'img-prompt', target: 'flux', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...ve, markerEnd: arrow(VIOLET) },
  { id: 'e-i2', source: 'flux', target: 'img-out', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...ve, markerEnd: arrow(VIOLET) },

  // Audio pipeline
  { id: 'e-a1', source: 'audio-in', target: 'asr', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...be, markerEnd: arrow(BLUE) },
  { id: 'e-a2', source: 'asr', target: 'text-out', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...be, markerEnd: arrow(BLUE) },
];

export default function PipelineFlow() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ height: 420, display: 'grid', placeItems: 'center', color: '#5A5A7A' }}>Loading...</div>;

  return (
    <div style={{ height: 420, width: '100%' }}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false}
        preventScrolling={false} proOptions={{ hideAttribution: true }} style={{ background: 'transparent' }}>
        <Background color="rgba(59, 130, 246, 0.04)" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
