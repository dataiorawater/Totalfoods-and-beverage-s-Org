function parseThaiDate(dateStr) {
  if (!dateStr) return new Date();
  
  // If it's already a valid ISO string (like from mockData)
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime()) && dateStr.includes('-')) {
    return parsed;
  }

  // Handle Thai format: DD/MM/YYYY or DD/MM/YYYY HH:MM or DD/MM/YYYY HH:MM:SS
  const parts = dateStr.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  if (datePart.includes('/')) {
    const [day, month, year] = datePart.split('/');
    let y = parseInt(year);
    // If year > 2500, subtract 543 (Buddhist Era)
    if (y > 2500) y -= 543;
    
    // For time
    const [hour, min, sec] = timePart.split(':');
    
    return new Date(y, parseInt(month) - 1, parseInt(day), parseInt(hour || '0'), parseInt(min || '0'), parseInt(sec || '0'));
  }
  
  return parsed;
}

console.log(parseThaiDate('2023-10-01T10:00:00Z'));
console.log(parseThaiDate('15/09/2569 17:30'));
console.log(parseThaiDate('15/09/2569'));
console.log(parseThaiDate('15/09/2026 17:30'));
