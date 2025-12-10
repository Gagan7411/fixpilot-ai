import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { HeatmapDataPoint } from '../types';

interface SeverityHeatmapProps {
  data: HeatmapDataPoint[];
}

const SeverityHeatmap: React.FC<SeverityHeatmapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 200;
    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Group data
    const xDomain = d3.range(0, 24); // 24 hours
    const yDomain = Array.from(new Set(data.map(d => d.fileId)));

    const x = d3.scaleBand()
      .domain(xDomain.map(String))
      .range([0, innerWidth])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(yDomain)
      .range([innerHeight, 0])
      .padding(0.05);

    const color = d3.scaleSequential()
      .interpolator(d3.interpolateInferno)
      .domain([0, 10]);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => !(i % 2))));

    g.append("g")
      .call(d3.axisLeft(y).tickSize(0));

    // Cells
    g.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => x(String(d.hour)) || 0)
      .attr("y", d => y(d.fileId) || 0)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.severity))
      .attr("rx", 2)
      .attr("ry", 2)
      .append("title")
      .text(d => `Hour: ${d.hour}, File: ${d.fileId}, Severity: ${d.severity}`);

    // Legend title
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 10) // Adjust if needed
      .attr("text-anchor", "middle")
      .attr("fill", "#8b949e")
      .attr("font-size", "10px")
      .text("Error Intensity (24h Window)");

  }, [data]);

  return (
    <div className="bg-surface border border-border rounded-lg p-4 shadow-sm">
      <h3 className="text-text font-semibold mb-2 text-sm">Cluster Intensity Heatmap</h3>
      <div className="flex justify-center">
        <svg ref={svgRef} width={600} height={230} className="w-full h-auto" />
      </div>
    </div>
  );
};

export default SeverityHeatmap;