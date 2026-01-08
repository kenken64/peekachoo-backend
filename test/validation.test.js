const {
	validateUsername,
	containsXSS,
	containsSQLInjection,
	sanitizeHTML,
	validateDisplayName,
	validateRegistrationInput,
} = require("../src/utils/validation");

describe("Validation Utils", () => {
	describe("validateUsername", () => {
		it("should accept valid usernames", () => {
			expect(validateUsername("john123").valid).toBe(true);
			expect(validateUsername("user_name").valid).toBe(true);
			expect(validateUsername("user-name").valid).toBe(true);
			expect(validateUsername("abc").valid).toBe(true);
			expect(validateUsername("a".repeat(30)).valid).toBe(true);
		});

		it("should reject empty or missing username", () => {
			expect(validateUsername("").valid).toBe(false);
			expect(validateUsername(null).valid).toBe(false);
			expect(validateUsername(undefined).valid).toBe(false);
		});

		it("should reject username that is too short", () => {
			const result = validateUsername("ab");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("at least 3 characters");
		});

		it("should reject username that is too long", () => {
			const result = validateUsername("a".repeat(31));
			expect(result.valid).toBe(false);
			expect(result.error).toContain("30 characters or less");
		});

		it("should reject usernames with special characters", () => {
			expect(validateUsername("user@name").valid).toBe(false);
			expect(validateUsername("user name").valid).toBe(false);
			expect(validateUsername("user.name").valid).toBe(false);
			expect(validateUsername("user!name").valid).toBe(false);
		});

		it("should reject XSS attack usernames", () => {
			expect(validateUsername("<script>alert(1)</script>").valid).toBe(false);
			expect(validateUsername('"><img src=x onerror=alert(1)>').valid).toBe(
				false,
			);
			expect(validateUsername("javascript:alert(1)").valid).toBe(false);
		});
	});

	describe("containsXSS", () => {
		it("should return false for clean input", () => {
			expect(containsXSS("hello world")).toBe(false);
			expect(containsXSS("normal text 123")).toBe(false);
			expect(containsXSS("")).toBe(false);
			expect(containsXSS(null)).toBe(false);
		});

		it("should detect script tags", () => {
			expect(containsXSS("<script>alert(1)</script>")).toBe(true);
			expect(containsXSS("<SCRIPT>alert(1)</SCRIPT>")).toBe(true);
			expect(containsXSS("text<script>")).toBe(true);
		});

		it("should detect event handlers", () => {
			expect(containsXSS("onerror=alert(1)")).toBe(true);
			expect(containsXSS("onclick=evil()")).toBe(true);
			expect(containsXSS("onload = hack()")).toBe(true);
			expect(containsXSS("ONMOUSEOVER=bad()")).toBe(true);
		});

		it("should detect img tags", () => {
			expect(containsXSS("<img src=x onerror=alert(1)>")).toBe(true);
			expect(containsXSS('<IMG SRC="random.gif">')).toBe(true);
		});

		it("should detect svg tags", () => {
			expect(containsXSS("<svg onload=alert(1)>")).toBe(true);
			expect(containsXSS("<svg/onload=alert(1)>")).toBe(true);
		});

		it("should detect javascript protocol", () => {
			expect(containsXSS("javascript:alert(1)")).toBe(true);
			expect(containsXSS("JAVASCRIPT:void(0)")).toBe(true);
		});

		it("should detect data protocol", () => {
			expect(containsXSS("data:text/html,<script>alert(1)</script>")).toBe(
				true,
			);
		});

		it("should detect iframe tags", () => {
			expect(containsXSS('<iframe src="evil.com">')).toBe(true);
		});
	});

	describe("containsSQLInjection", () => {
		it("should return false for clean input", () => {
			expect(containsSQLInjection("hello world")).toBe(false);
			expect(containsSQLInjection("normal text 123")).toBe(false);
			expect(containsSQLInjection("")).toBe(false);
			expect(containsSQLInjection(null)).toBe(false);
		});

		it("should detect SQL injection patterns", () => {
			expect(containsSQLInjection("' OR '1'='1")).toBe(true);
			expect(containsSQLInjection("'; DROP TABLE users--")).toBe(true);
			expect(containsSQLInjection("UNION SELECT * FROM users")).toBe(true);
			expect(containsSQLInjection("'; DELETE FROM users;--")).toBe(true);
		});

		it("should detect comment-based injection", () => {
			expect(containsSQLInjection("admin'--")).toBe(true);
		});
	});

	describe("sanitizeHTML", () => {
		it("should escape HTML entities", () => {
			expect(sanitizeHTML("<script>")).toBe("&lt;script&gt;");
			expect(sanitizeHTML('"test"')).toBe("&quot;test&quot;");
			expect(sanitizeHTML("'test'")).toBe("&#x27;test&#x27;");
			expect(sanitizeHTML("a & b")).toBe("a &amp; b");
			expect(sanitizeHTML("a/b")).toBe("a&#x2F;b");
		});

		it("should handle empty or null input", () => {
			expect(sanitizeHTML("")).toBe("");
			expect(sanitizeHTML(null)).toBe("");
			expect(sanitizeHTML(undefined)).toBe("");
		});

		it("should neutralize XSS attacks", () => {
			const xss = '<script>alert("xss")</script>';
			const sanitized = sanitizeHTML(xss);
			expect(sanitized).not.toContain("<script>");
			expect(sanitized).toBe(
				"&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;",
			);
		});
	});

	describe("validateDisplayName", () => {
		it("should accept valid display names", () => {
			expect(validateDisplayName("John Doe").valid).toBe(true);
			expect(validateDisplayName("JD").valid).toBe(true);
			expect(validateDisplayName("").valid).toBe(true);
			expect(validateDisplayName(null).valid).toBe(true);
		});

		it("should reject display name that is too long", () => {
			const result = validateDisplayName("a".repeat(51));
			expect(result.valid).toBe(false);
			expect(result.error).toContain("50 characters or less");
		});

		it("should reject XSS in display names", () => {
			const result = validateDisplayName("<script>alert(1)</script>");
			expect(result.valid).toBe(false);
			expect(result.error).toContain("invalid characters");
		});

		it("should sanitize valid display names", () => {
			const result = validateDisplayName("John & Jane");
			expect(result.valid).toBe(true);
			expect(result.sanitized).toBe("John &amp; Jane");
		});
	});

	describe("validateRegistrationInput", () => {
		it("should validate correct input", () => {
			const result = validateRegistrationInput({
				username: "testuser",
				displayName: "Test User",
			});
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.sanitized.username).toBe("testuser");
			expect(result.sanitized.displayName).toBe("Test User");
		});

		it("should reject invalid username", () => {
			const result = validateRegistrationInput({
				username: "<script>",
				displayName: "Valid Name",
			});
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it("should reject XSS in display name", () => {
			const result = validateRegistrationInput({
				username: "validuser",
				displayName: "<img src=x onerror=alert(1)>",
			});
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it("should use username as display name fallback", () => {
			const result = validateRegistrationInput({
				username: "testuser",
				displayName: "",
			});
			expect(result.valid).toBe(true);
			expect(result.sanitized.displayName).toBe("testuser");
		});

		it("should collect multiple errors", () => {
			const result = validateRegistrationInput({
				username: "",
				displayName: "<script>evil</script>",
			});
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBe(2);
		});
	});
});
