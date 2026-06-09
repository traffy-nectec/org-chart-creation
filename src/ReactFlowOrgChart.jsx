import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ReactFlow, 
  ReactFlowProvider, 
  Controls, 
  Background, 
  Handle, 
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Panel,
  getNodesBounds,
  getViewportForBounds
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash2, MapPin, Network, AlertTriangle, ChevronDown, ChevronRight, ChevronUp, ChevronLeft, Settings, Download } from 'lucide-react';
import { toPng } from 'html-to-image';

const getAreaCount = (areas) => {
  if (!areas) return 0;
  let count = 0;
  if (areas.tambons) count += areas.tambons.length;
  if (areas.amphoes) count += Object.keys(areas.amphoes).length;
  if (areas.province) count += 1;
  return count;
};

const formatAreaLabel = (areas) => {
  if (!areas) return '';
  const parts = [];
  if (areas.tambon) {
    const prefix = areas.province === "กรุงเทพมหานคร" ? "แขวง" : "ต.";
    parts.push(`${prefix}${areas.tambon}`);
  }
  if (areas.amphoe) {
    const prefix = areas.province === "กรุงเทพมหานคร" ? "เขต" : "อ.";
    parts.push(`${prefix}${areas.amphoe}`);
  }
  if (areas.province) {
    const prefix = areas.province === "กรุงเทพมหานคร" ? "" : "จ.";
    parts.push(`${prefix}${areas.province}`);
  }
  return parts.join(' ');
};

// --- Custom Node ---
const OrgNodeFlow = ({ id, data }) => {
  const { node, isSelected, hasError, hasWarning, issue, treeLayout, isDrillable, setFocusNodeId, handleAddNode, handleDeleteNode, isParent, childCount, setSelectedNodeId } = data;
  const isVert = treeLayout === 'vertical';

  return (
    <div 
      className={`relative p-3 rounded-2xl transition-all duration-200 bg-white ${isParent ? 'w-[480px]' : 'w-[240px]'} h-[210px] flex flex-col ${
        isParent 
          ? `border-[3px] shadow-lg ${hasError ? '!border-red-500' : hasWarning ? '!border-amber-500' : 'border-slate-900'}` 
          : 'border-2 border-slate-200 shadow-sm'
      } ${
        isSelected
          ? 'ring-4 ring-blue-500/20 !border-blue-500' 
          : hasError && !isParent
            ? '!border-red-500'
            : hasWarning && !isParent
              ? '!border-amber-500'
              : ''
      }`}
      onClick={(e) => {
        if (!isParent) {
          e.stopPropagation();
          setSelectedNodeId(node.id);
        }
      }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex justify-between items-start group">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded font-bold ${
            hasError ? 'bg-red-100 text-red-700' : 'text-slate-650 bg-slate-100'
          }`}>ระดับ {node.level || 1}</span>
          {isParent && (
            <span className="px-1.5 py-0.5 rounded font-bold bg-slate-900 text-white flex items-center">ต้นสังกัด</span>
          )}
          {hasWarning && (
            <span className="px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-700 flex items-center" title={issue?.message}>
              ข้อสังเกต
            </span>
          )}
        </div>
        
        <div className={`flex gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {!isParent && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
              className="w-6 h-6 bg-red-50 text-red-700 rounded flex items-center justify-center hover:bg-red-500 hover:text-white"
              title="ลบหน่วยงานนี้"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex items-start gap-2 mb-2 min-w-0">
        <div className="font-bold text-sm text-slate-800 flex-1 min-w-0">
          <span className="line-clamp-3 break-words" title={node.name}>{node.name || <span className="opacity-50 italic">ไม่ได้ระบุชื่อ</span>}</span>
          {issue && hasError && (
            <span className={`inline-block mt-1 text-red-500`} title={issue.message}>
              <AlertTriangle size={14} className="animate-pulse inline" />
            </span>
          )}
        </div>
      </div>
      
      <div className="shrink-0 flex gap-1.5 text-[10px] font-medium">
        <div className="flex-1 bg-slate-50 border border-slate-100 p-1.5 rounded-lg flex flex-col justify-center items-center text-center">
          <span className="text-slate-400">พื้นที่รับผิดชอบ</span>
          <span className="font-bold text-slate-700 text-xs mt-0.5">{getAreaCount(node.areas) || '-'}</span>
        </div>
        <div className="flex-1 bg-slate-50 border border-slate-100 p-1.5 rounded-lg flex flex-col justify-center items-center text-center">
          <span className="text-slate-400">หน่วยงานย่อย</span>
          <span className="font-bold text-slate-700 text-xs mt-0.5">{childCount}</span>
        </div>
      </div>
      
      <div className="shrink-0 mt-2 flex gap-1.5 w-full">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNodeId(node.id);
          }}
          className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
        >
          ตั้งค่า
        </button>

        {isParent ? (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              handleAddNode(node.id, node.level || 1); 
            }}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors"
          >
            เพิ่มหน่วยงาน
          </button>
        ) : isDrillable ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setFocusNodeId(node.id); }}
            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-colors"
          >
            ดูหน่วยงานย่อย
          </button>
        ) : (
          <button 
            disabled
            className="flex-1 py-1.5 bg-slate-50 text-slate-300 rounded-lg text-[10px] font-bold transition-colors cursor-not-allowed"
          >
            ดูหน่วยงานย่อย
          </button>
        )}
      </div>
    </div>
  );
};


const GroupBgNode = ({ data }) => {
  return (
    <div className="w-full h-full rounded-[32px] border-[3px] border-dashed border-slate-300/80 bg-slate-100/50 flex justify-center items-end pb-6 pointer-events-none">
      {data?.label && <span className="text-slate-400 font-bold text-sm bg-white/80 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm">{data.label}</span>}
    </div>
  );
};

const nodeTypes = { orgNode: OrgNodeFlow, groupBg: GroupBgNode };

// --- 2D Grid Layout Engine ---
const getGridLayoutedElements = (nodes, edges) => {
  const isTarget = new Set(edges.map(e => e.target));
  const roots = nodes.filter(n => !isTarget.has(n.id));
  
  const nodeWidth = 240;
  const parentWidth = 480;
  const nodeHeight = 210;
  const gapX = 40;
  const gapY = 80;
  const maxCols = 5;
  
  const layoutedNodes = [];
  let currentYOffset = 0;
  
  roots.forEach(root => {
    const childEdges = edges.filter(e => e.source === root.id);
    const children = childEdges.map(e => nodes.find(n => n.id === e.target)).filter(Boolean);
    
    const numChildren = children.length;
    const cols = Math.min(numChildren, maxCols) || 1;
    const gridWidth = cols * nodeWidth + (cols - 1) * gapX;
    
    // Parent centered
    const parentX = 0;
    const parentY = currentYOffset;
    
    layoutedNodes.push({
      ...root,
      position: { x: parentX - parentWidth/2, y: parentY },
      targetPosition: 'top',
      sourcePosition: 'bottom'
    });
    
    const startX = -(gridWidth / 2) + (nodeWidth / 2);
    const childrenStartY = parentY + nodeHeight + gapY;
    
    const numRows = Math.ceil(numChildren / maxCols);
    const gridTotalHeight = numRows * nodeHeight + Math.max(0, numRows - 1) * gapY;

    // Add background group node if there are children
    if (numChildren > 0) {
      const padding = 50;
      layoutedNodes.push({
        id: `groupBg-${root.id}`,
        type: 'groupBg',
        position: { x: -(gridWidth / 2) - padding, y: childrenStartY - padding },
        style: { 
          width: gridWidth + 2 * padding, 
          height: gridTotalHeight + 2 * padding, 
          zIndex: -1 
        },
        data: { label: `หน่วยงานย่อยภายใต้ ${root.data?.node?.name || ''}` },
        selectable: false,
        draggable: false,
      });
    }

    children.forEach((child, index) => {
      const row = Math.floor(index / maxCols);
      const col = index % maxCols;
      const x = startX + col * (nodeWidth + gapX);
      const y = childrenStartY + row * (nodeHeight + gapY);
      
      layoutedNodes.push({
        ...child,
        position: { x: x - nodeWidth/2, y },
        targetPosition: 'top',
        sourcePosition: 'bottom'
      });
    });
    
    currentYOffset += nodeHeight + gapY + gridTotalHeight + gapY;
  });
  
  return { nodes: layoutedNodes, edges };
};

// --- Main Flow Component ---
const FlowInner = ({ orgTree, organizations, focusNodeId, setFocusNodeId, selectedNodeId, setSelectedNodeId, searchedNodeId, setSearchedNodeId, handleAddNode, handleDeleteNode, treeLayout, nodeIssues }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView, setViewport } = useReactFlow();

  const prevNodeCountRef = React.useRef(0);
  const prevFocusNodeIdRef = React.useRef(focusNodeId);
  
  useEffect(() => {
    if (!orgTree || orgTree.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    let focusRoots = orgTree;
    if (focusNodeId) {
      const findInTree = (nodes, id) => {
        for (let node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findInTree(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const focusNode = findInTree(orgTree, focusNodeId);
      if (focusNode) {
        focusRoots = [focusNode];
      }
    }

    const flatNodes = [];
    const flatEdges = [];

    const traverse = (node, depth) => {
      const childCount = node.children ? node.children.length : 0;
      const issue = nodeIssues?.get(node.id);

      flatNodes.push({
        id: node.id,
        type: 'orgNode',
        data: {
          node,
          isSelected: selectedNodeId === node.id,
          hasError: issue?.type === 'error',
          hasWarning: issue?.type === 'warning',
          issue,
          treeLayout: 'vertical', // Force vertical for grid layout handles
          childCount,
          isParent: depth === 0,
          isDrillable: depth === 1 && childCount > 0,
          setFocusNodeId,
          handleAddNode,
          handleDeleteNode,
          setSelectedNodeId
        }
      });

      if (depth === 0 && childCount > 0) {
        node.children.forEach(child => {
          flatEdges.push({
            id: `e-${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#cbd5e1', strokeWidth: 1.5, opacity: 0.5 },
          });
          traverse(child, depth + 1);
        });
      }
    };

    focusRoots.forEach(root => traverse(root, 0));

    const { nodes: layoutedNodes } = getGridLayoutedElements(flatNodes, flatEdges);

    setNodes(layoutedNodes);
    setEdges([]);

    const totalNodesCount = layoutedNodes.length;
    const isDrillDownChange = focusNodeId !== prevFocusNodeIdRef.current;
    const isSingleAdd = totalNodesCount - prevNodeCountRef.current === 1;
    const isBulkChange = Math.abs(totalNodesCount - prevNodeCountRef.current) > 1;
    const isInitialLoad = prevNodeCountRef.current === 0;

    if (searchedNodeId) {
      setTimeout(() => {
        fitView({ nodes: [{ id: searchedNodeId }], duration: 800, maxZoom: 1 });
        setSearchedNodeId(null);
      }, 150);
    } else if (isSingleAdd && selectedNodeId && !isDrillDownChange) {
      setTimeout(() => {
        fitView({ nodes: [{ id: selectedNodeId }], duration: 800, maxZoom: 1 });
      }, 100);
    } else if (totalNodesCount > 0 && (isInitialLoad || isBulkChange || isDrillDownChange)) {
      setTimeout(() => {
        const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
        const width = reactFlowBounds ? reactFlowBounds.width : window.innerWidth;
        
        if (layoutedNodes.length > 0) {
          let minX = Infinity, maxX = -Infinity;
          layoutedNodes.forEach(n => {
            minX = Math.min(minX, n.position.x);
            maxX = Math.max(maxX, n.position.x + 240);
          });
          const graphWidth = maxX - minX;
          const zoom = Math.min(1, width / (graphWidth + 80));
          
          setViewport({ x: width / 2, y: 40, zoom }, { duration: 800 });
        }
      }, 100);
    }
    prevNodeCountRef.current = totalNodesCount;
    prevFocusNodeIdRef.current = focusNodeId;

  }, [orgTree, focusNodeId, treeLayout, selectedNodeId, nodeIssues]);

  const onDownload = () => {
    if (nodes.length === 0) return;
    const nodesBounds = getNodesBounds(nodes);
    
    // Add padding to bounds
    const imageWidth = nodesBounds.width + 100;
    const imageHeight = nodesBounds.height + 100;

    const transform = getViewportForBounds(
      nodesBounds,
      imageWidth,
      imageHeight,
      0.5,
      2
    );

    const element = document.querySelector('.react-flow__viewport');
    if (!element) return;

    toPng(element, {
      backgroundColor: '#f8fafc',
      width: imageWidth,
      height: imageHeight,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
      },
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.setAttribute('download', 'org-chart.png');
      a.setAttribute('href', dataUrl);
      a.click();
    }).catch(err => {
      console.error('Failed to export image', err);
    });
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
      onPaneClick={() => setSelectedNodeId(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      minZoom={0.1}
      maxZoom={2}
    >
      <Background color="#e2e8f0" gap={20} size={1} />
      <Controls />
      <Panel position="top-right">
        <button
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          onClick={onDownload}
          title="ส่งออกผังองค์กรเป็นรูปภาพ"
        >
          <Download size={16} />
          บันทึกรูปภาพ (PNG)
        </button>
      </Panel>
    </ReactFlow>
  );
};

export default function ReactFlowOrgChart(props) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}
