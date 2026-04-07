import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";

export function NumericInput({ value, onChange, placeholder = "", step = "any", min, max, required = false, className = "", ...props }) {
  const [localValue, setLocalValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      setLocalValue(String(value));
    } else {
      setLocalValue('');
    }
  }, [value]);

  const validateNumber = (val) => {
    if (val === '') {
      setError('');
      return true;
    }

    const num = parseFloat(val);
    if (isNaN(num)) {
      setError('Please enter a valid number');
      return false;
    }

    if (min !== undefined && num < parseFloat(min)) {
      setError(`Value must be at least ${min}`);
      return false;
    }

    if (max !== undefined && num > parseFloat(max)) {
      setError(`Value must be at most ${max}`);
      return false;
    }

    setError('');
    return true;
  };

  const handleChange = (e) => {
    const val = e.target.value;
    
    // Allow empty, numbers, and decimal point
    if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
      setLocalValue(val);
      
      if (val === '') {
        onChange({ target: { value: '' } });
        setError('');
      } else if (validateNumber(val)) {
        onChange({ target: { value: val } });
      }
    }
  };

  const handleBlur = () => {
    if (localValue !== '') {
      validateNumber(localValue);
    }
  };

  return (
    <div className="space-y-1">
      <Input
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        className={`${className} ${error ? 'border-red-500' : ''}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}