import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';

export const GaugeCard = ({ title, value, unit, min = 0, max = 100, color }) => {
  const angle = 180 * (value - min) / (max - min);
  const needleLength = 60;
  const cx = 100, cy = 100;
  const x = cx - needleLength * Math.cos(Math.PI * angle / 180);
  const y = cy - needleLength * Math.sin(Math.PI * angle / 180);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="body2" color="textSecondary">{title}</Typography>
      <Box sx={{ position: 'relative', width: '200px', height: '120px' }}>
        <svg width="100%" height="100%" viewBox="0 0 200 120">
          <path d="M20,100 A80,80 0 0,1 180,100" fill="none" stroke="#2c2c4c" strokeWidth="14" />
          <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth="3" />
          <circle cx={cx} cy={cy} r="5" fill={color} />
          <text x="20" y="115" fontSize="12" fill="#888" textAnchor="middle">{min}</text>
          <text x="100" y="115" fontSize="12" fill="#888" textAnchor="middle">{(min + max) / 2}</text>
          <text x="180" y="115" fontSize="12" fill="#888" textAnchor="middle">{max}</text>
        </svg>
        <Typography
          variant="h4"
          sx={{
            position: 'absolute',
            bottom: '4px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: color,
            fontWeight: 'bold',
            background: 'rgba(0,0,0,0.5)',
            px: 1,
            borderRadius: 1,
          }}
        >
          {value} {unit}
        </Typography>
      </Box>
    </Box>
  );
};

export const BatteryGauge = ({ value }) => {
  let color = '#00e676';
  if (value < 50) color = '#ffc107';
  if (value < 30) color = '#ff1744';

  return (
    <Box sx={{ width: '100%', textAlign: 'center' }}>
      <Typography variant="body2" gutterBottom color="textSecondary">
        Battery Level
      </Typography>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 12,
          borderRadius: 6,
          backgroundColor: '#2c2c4c',
          '& .MuiLinearProgress-bar': {
            backgroundColor: color
          }
        }}
      />
      <Typography
        variant="h6"
        sx={{
          mt: 1,
          color,
          fontWeight: 'bold',
          background: 'rgba(0,0,0,0.5)',
          px: 1,
          display: 'inline-block',
          borderRadius: 1,
        }}
      >
        {value}%
      </Typography>
    </Box>
  );
};