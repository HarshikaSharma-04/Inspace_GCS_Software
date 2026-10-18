// for polar graphs
// background = #6750a4, font = monospace

const HB_DIV = 'heading-bearing-plot';
const FONT_FAMILY = 'monospace';

// colors for the #e9e6ff background
const COLORS = {
    bg: '#ffffff',
    text: '#070707',
    grid: 'rgba(0, 0, 0, 0.30)',
    axisLine: 'rgba(0, 0, 0, 0.60)',
    heading: '#01174e',   // bright cyan
    bearing: '#0f6801'    // bright amber
};

export function initHeadingBearingPlot() {
    const data = [
        {
            type: 'scatterpolar',
            mode: 'lines+markers',
            r: [0, 1],
            theta: [0, 0],
            name: 'Heading',
            line: { color: COLORS.heading, width: 6 },
            marker: { size: [0, 16], symbol: 'triangle-up', color: COLORS.heading }
        },
        {
            type: 'scatterpolar',
            mode: 'lines+markers',
            r: [0, 1],
            theta: [0, 0],
            name: 'Bearing',
            line: { color: COLORS.bearing, width: 6, dash: 'dot' },
            marker: { size: [0, 16], symbol: 'circle', color: COLORS.bearing }
        }
    ];

    const layout = {
        polar: {
            bgcolor: COLORS.bg,
            domain: { x: [0.05, 0.95], y: [0.22, 0.92] },
            radialaxis: {
                visible: true,
                range: [0, 1],
                showticklabels: false,
                ticks: '',
                gridcolor: COLORS.grid,
                linecolor: 'rgba(0,0,0,0)'
            },
            angularaxis: {
                rotation: 90,
                direction: 'clockwise',
                tickmode: 'array',
                tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
                ticktext: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
                tickfont: { size: 18, color: COLORS.text, family: FONT_FAMILY },
                gridcolor: COLORS.grid,
                linecolor: COLORS.axisLine
            }
        },
        paper_bgcolor: COLORS.bg,
        plot_bgcolor: COLORS.bg,
        font: { size: 16, color: COLORS.text, family: FONT_FAMILY },
        margin: { t: 30, b: 40, l: 45, r: 45 },
        legend: {
            orientation: 'h',
            x: 0.5,
            xanchor: 'center',
            y: -0.08,
            font: { size: 16, color: COLORS.text, family: FONT_FAMILY }
        },
        showlegend: true
    };

    Plotly.newPlot(HB_DIV, data, layout, { responsive: true, displayModeBar: false });
}

export function updateHeadingBearing(heading, bearing) {
    Plotly.restyle(HB_DIV, {
        theta: [[heading, heading], [bearing, bearing]],
        name: [`Heading (${heading.toFixed(0)}°)`, `Bearing (${bearing.toFixed(0)}°)`]
    }, [0, 1]);

    // signed error wrapped to ±180°
    return ((bearing - heading + 540) % 360) - 180;
}