# Council round 2: Dr Hélène Marchetti (sound-system design engineer)

## The other three

**Karim Benali (educational game designer)**
- **Strongest point:** "No criterion credits a change for an effect it does not cause." He reached the same S1 delay≠level error I did, independently, and he adds the pedagogical fix: a prediction written before the result, and the Δd/c calculation noted before the first Évaluer. That is the right way to stop students hill-climbing a number.
- **Most dangerous assumption:** that one classroom trial is enough to reopen (b). A classroom trial measures engagement and misconceptions. It does not measure model error. A class can like a heatmap that is 8 dB wrong.

**Lena Vogt (3D interaction designer)**
- **Strongest point:** "displayed vs live, always in words." Showing a stale result as if it were current is the most common way students misread a heatmap.
- **Most dangerous assumption:** that drawing the heatmap at 1.2 m ear height on the zone top makes it physically meaningful. It is meaningful only if the model behind it is labelled. A well-rendered map adds a credibility the physics has not earned.

**Tomás Ferreira (data architect)**
- **Strongest point:** embed the consumed inputs by value, and guard `engineVersion` with golden fixtures. That is exactly the verification layer the acoustics needs.
- **Most dangerous assumption:** that reproducible means trustworthy. Hashes and fixtures prove the same wrong number comes back every time. They are verification, not validation.

## The (a) vs (b) tension

Karim is right for BTS students, for now. The competencies actually assessed (Δd/c, the coverage angle, −6 dB per doubling of distance, the most exposed point) need only geometry plus *relative* direct level. The ladder already allows "relative level" at (a).

My round-1 version of "(b) relative-only" was, in substance, (a) with energetic summation of several speakers. What (b) adds beyond that is:
- absolute drive;
- the Hopkins-Stryker total level on estimated rooms;
- A-weighting with an assumed spectrum.

Those are exactly the parts with no validated error bound, and BTS students least need them.

The one thing (a) loses is the critical distance. Without it, S2 teaches "−6 dB per doubling" in a reverberant bar. So I would allow the d_c ring as an illustrative overlay at (a): computed from the room's V and RT60, with no level claim.

[POSITION CHANGE: C capped at (b), relative-dB only → C capped at (a)+ (relative direct-level map, energetic sum, illustrative d_c ring); (b) only after BOTH a classroom trial (Karim's gate) AND one documented measurement campaign (my gate) | Trigger: Karim's mapping showed the assessed competencies need no absolute or statistical level, so (b)'s extra content is all unvalidated risk]

## Held unchanged

My round-1 non-negotiables all stand:
- no absolute dB next to the decree limits;
- no STI number;
- no 1 W drive on powered speakers;
- S1 scored on arrival order;
- no error bound without measurement.

I also endorse Karim's prediction field, Lena's "displayed vs live" rule and Tomás's golden fixtures.

POSITION: C capped at (a)+ (relative direct level, d_c ring); (b) gated on classroom trial AND measurement campaign | CONFIDENCE: 80% | RISK: block absolute SPL vs decree limits, any error bound before measurement, STI numbers, 1 W drive on powered speakers, and any delay-credited level gain
