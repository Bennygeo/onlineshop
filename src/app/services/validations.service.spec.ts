import { TestBed } from '@angular/core/testing';
import { ValidationsService } from './validations.service';
import { FormControl } from '@angular/forms';

// ─────────────────────────────────────────────────────────
// ValidationsService Tests
// ─────────────────────────────────────────────────────────
describe('ValidationsService (static validators)', () => {

  // ── checkLimit() ─────────────────────────────────────
  describe('checkLimit(min, max)', () => {
    const validator = ValidationsService.checkLimit(1, 10);

    it('should return null for value within range', () => {
      const ctrl = new FormControl(5);
      expect(validator(ctrl)).toBeNull();
    });

    it('should return null for boundary min value', () => {
      expect(validator(new FormControl(1))).toBeNull();
    });

    it('should return null for boundary max value', () => {
      expect(validator(new FormControl(10))).toBeNull();
    });

    it('should return {range: true} for value below min', () => {
      // Note: the validator uses c.value && (...) so the value must be truthy.
      // A value of -1 is truthy (non-zero), so it correctly triggers the range error.
      expect(validator(new FormControl(-1))).toEqual({ range: true });
    });

    it('should return null for value=0 (falsy — validator skips check)', () => {
      // The implementation: `if (c.value && ...)` — 0 is falsy so no error returned.
      expect(validator(new FormControl(0))).toBeNull();
    });

    it('should return {range: true} for value above max', () => {
      expect(validator(new FormControl(11))).toEqual({ range: true });
    });

    it('should return {range: true} for a non-numeric string', () => {
      expect(validator(new FormControl('abc'))).toEqual({ range: true });
    });

    it('should return null when value is empty/falsy (field not filled)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
    });
  });

  // ── emailValidatorFn() ────────────────────────────────
  describe('emailValidatorFn()', () => {
    const emailValidator = ValidationsService.emailValidatorFn();

    it('should return null for a valid email', () => {
      expect(emailValidator(new FormControl('user@example.com'))).toBeNull();
    });

    it('should return null for email with subdomain', () => {
      expect(emailValidator(new FormControl('user@mail.example.co.in'))).toBeNull();
    });

    it('should return error for email without @', () => {
      const result = emailValidator(new FormControl('invalidemail'));
      expect(result).toEqual({ emailvalidator: { valid: false } });
    });

    it('should return error for email without domain', () => {
      const result = emailValidator(new FormControl('user@'));
      expect(result).toEqual({ emailvalidator: { valid: false } });
    });

    it('should return error for empty string', () => {
      const result = emailValidator(new FormControl(''));
      expect(result).toEqual({ emailvalidator: { valid: false } });
    });

    it('should return error for email with spaces', () => {
      const result = emailValidator(new FormControl('user @example.com'));
      expect(result).toEqual({ emailvalidator: { valid: false } });
    });

    it('should return error for consecutive dots in domain', () => {
      const result = emailValidator(new FormControl('user@example..com'));
      expect(result).toEqual({ emailvalidator: { valid: false } });
    });
  });

  // ── maxLinesValidator() ───────────────────────────────
  describe('maxLinesValidator(limit)', () => {
    const limitTo3 = ValidationsService.maxLinesValidator(3);

    it('should return null for text within line limit', () => {
      expect(limitTo3(new FormControl('line1\nline2\nline3'))).toBeNull();
    });

    it('should return {maxLines: true} when lines exceed limit', () => {
      const result = limitTo3(new FormControl('line1\nline2\nline3\nline4'));
      expect(result).toEqual({ maxLines: { value: true } });
    });

    it('should return null for empty string', () => {
      expect(limitTo3(new FormControl(''))).toBeNull();
    });

    it('should return null for single line text', () => {
      expect(limitTo3(new FormControl('single line text'))).toBeNull();
    });
  });
});
