/**
 * Unit tests for astronomy.js
 */

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`✅ ${message}`);
};

const runTests = () => {
    console.log("Starting Astronomy Engine Tests...");

    try {
        // Test Julian Date
        const testDate = new Date('2000-01-01T12:00:00Z');
        const jd = Astronomy.julianDate(testDate);
        assert(Math.abs(jd - 2451545.0) < 0.0001, "Julian Date for J2000.0 should be 2451545.0");

        // Test norm360
        assert(Astronomy.norm360(400) === 40, "norm360(400) should be 40");
        assert(Astronomy.norm360(-10) === 350, "norm360(-10) should be 350");

        // Test localSiderealTime
        // This is harder to test without a known value, but let's check consistency
        const lst = Astronomy.localSiderealTime(jd, 0);
        assert(lst >= 0 && lst < 360, "Local Sidereal Time should be between 0 and 360");

        // Test equatorialToHorizontal
        // Polaris is roughly at RA 37.95, Dec 89.26
        const polaris = Astronomy.equatorialToHorizontal(37.95, 89.26, 90, 0); // At North Pole
        assert(polaris.alt > 88, "Polaris should be near zenith at the North Pole");

        // Test Planet Position existence
        const mars = Astronomy.planetPosition('mars', jd);
        assert(mars && mars.ra !== undefined && mars.dec !== undefined, "Mars position should be calculable");

        console.log("All tests passed!");
        document.body.innerHTML += '<h2 style="color: green;">All Tests Passed!</h2>';
    } catch (e) {
        console.error(e);
        document.body.innerHTML += `<h2 style="color: red;">Test Failed: ${e.message}</h2>`;
    }
};

window.onload = runTests;
