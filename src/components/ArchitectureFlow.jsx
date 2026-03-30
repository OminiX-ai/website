import React, { useEffect, useState } from 'react';
import { ReactFlow, Background, Position, Handle } from '@xyflow/react';
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

const makeNodeStyle = (bg, border) => ({
  background: bg,
  border: `2px solid ${border}`,
  borderRadius: '10px',
  padding: '12px 18px',
  minWidth: '160px',
  textAlign: 'center',
  color: '#fff',
  fontFamily: "'Geist Mono', monospace",
  fontSize: '14px',
  letterSpacing: '0.02em',
  boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 15px ${border}22`,
});

const OminiXNode = ({ data }) => (
  <div style={makeNodeStyle(data.bg, data.border)}>
    <AllHandles />
    <div style={{ fontWeight: 600, fontSize: '15px' }}>{data.label}</div>
    {data.description && (
      <div style={{ opacity: 0.8, marginTop: '4px', fontSize: '12px', fontFamily: "'Geist', sans-serif" }}>
        {data.description}
      </div>
    )}
  </div>
);

const EntryNode = ({ data }) => (
  <div style={{ ...makeNodeStyle(BLUE, BLUE_DARK), color: '#fff', minWidth: '220px', fontSize: '16px', fontWeight: 700 }}>
    <AllHandles />
    <div>{data.label}</div>
  </div>
);

const ModelNode = ({ data }) => (
  <div style={{
    background: 'rgba(139, 92, 246, 0.08)', border: `2px dashed ${VIOLET}`, borderRadius: '8px',
    padding: '8px 14px', minWidth: '100px', textAlign: 'center', color: VIOLET,
    fontFamily: "'Geist Mono', monospace", fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em',
  }}>
    <AllHandles />
    {data.label}
  </div>
);

const nodeTypes = { ominix: OminiXNode, entry: EntryNode, model: ModelNode };

const initialNodes = [
  // Row 0: Studio
  { id: 'studio', type: 'entry', position: { x: 260, y: 0 }, data: { label: 'OminiX Studio' } },
  // Row 1: API Server
  { id: 'api', type: 'ominix', position: { x: 260, y: 110 }, data: { label: 'OminiX API Server', description: 'OpenAI-compatible REST + WebSocket', bg: BLUE, border: BLUE_DARK } },
  // Row 2: Three backends
  { id: 'mlx', type: 'ominix', position: { x: 40, y: 230 }, data: { label: 'MLX (Apple)', description: 'M1 - M4 Metal', bg: VIOLET, border: VIOLET_DARK } },
  { id: 'ascend', type: 'ominix', position: { x: 260, y: 230 }, data: { label: 'Ascend (Huawei)', description: '910B / 310P NPU', bg: VIOLET, border: VIOLET_DARK } },
  { id: 'cuda', type: 'ominix', position: { x: 480, y: 230 }, data: { label: 'CUDA (Future)', description: 'NVIDIA GPU', bg: NEUTRAL, border: NEUTRAL_DARK } },
  // Row 3: Model nodes under MLX
  { id: 'mlx-llm', type: 'model', position: { x: 0, y: 350 }, data: { label: 'LLM' } },
  { id: 'mlx-tts', type: 'model', position: { x: 80, y: 350 }, data: { label: 'TTS' } },
  { id: 'mlx-asr', type: 'model', position: { x: 0, y: 410 }, data: { label: 'ASR' } },
  { id: 'mlx-img', type: 'model', position: { x: 80, y: 410 }, data: { label: 'Image Gen' } },
  // Row 3: Model nodes under Ascend
  { id: 'asc-llm', type: 'model', position: { x: 230, y: 350 }, data: { label: 'LLM' } },
  { id: 'asc-asr', type: 'model', position: { x: 310, y: 350 }, data: { label: 'ASR' } },
  { id: 'asc-img', type: 'model', position: { x: 230, y: 410 }, data: { label: 'Image Gen' } },
  // Row 3: Model nodes under CUDA
  { id: 'cuda-llm', type: 'model', position: { x: 470, y: 350 }, data: { label: 'LLM' } },
  { id: 'cuda-tts', type: 'model', position: { x: 550, y: 350 }, data: { label: 'TTS' } },
];

const be = { type: 'smoothstep', animated: true, style: { stroke: BLUE, strokeWidth: 2 } };
const ve = { type: 'smoothstep', animated: true, style: { stroke: VIOLET, strokeWidth: 2 } };
const de = { type: 'smoothstep', animated: true, style: { stroke: VIOLET, strokeWidth: 1.5, strokeDasharray: '5 5' } };

const initialEdges = [
  { id: 'e1', source: 'studio', target: 'api', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...be },
  { id: 'e2', source: 'api', target: 'mlx', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...be },
  { id: 'e3', source: 'api', target: 'ascend', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...be },
  { id: 'e4', source: 'api', target: 'cuda', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...be },
  // MLX to models
  { id: 'e5', source: 'mlx', target: 'mlx-llm', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  { id: 'e6', source: 'mlx', target: 'mlx-tts', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  { id: 'e7', source: 'mlx', target: 'mlx-asr', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  { id: 'e8', source: 'mlx', target: 'mlx-img', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  // Ascend to models
  { id: 'e9', source: 'ascend', target: 'asc-llm', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  { id: 'e10', source: 'ascend', target: 'asc-asr', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  { id: 'e11', source: 'ascend', target: 'asc-img', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  // CUDA to models
  { id: 'e12', source: 'cuda', target: 'cuda-llm', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
  { id: 'e13', source: 'cuda', target: 'cuda-tts', sourceHandle: 'bot-src', targetHandle: 'top-tgt', ...de },
];

export default function ArchitectureFlow() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ height: 520, display: 'grid', placeItems: 'center', color: '#5A5A7A' }}>Loading...</div>;

  return (
    <div style={{ height: 520, width: '100%' }}>
      <ReactFlow nodes={initialNodes} edges={initialEdges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false}
        preventScrolling={false} proOptions={{ hideAttribution: true }} style={{ background: 'transparent' }}>
        <Background color="rgba(59, 130, 246, 0.04)" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
