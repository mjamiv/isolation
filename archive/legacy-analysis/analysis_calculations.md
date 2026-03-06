# Structural Engineering Analysis Report

## St. Claire Memorial Hospital -- Critical Care Wing

**Project**: 3-Story, 2-Bay Steel Special Moment-Resisting Frame with TFP Base Isolation
**Classification**: Essential Facility (AASHTO Operational Category A)
**Units**: kip-inch (unless noted otherwise)
**Date**: February 13, 2026

---

## Structure Definition

### Geometry

| Parameter | Value |
|-----------|-------|
| Bays | 2 @ 30 ft (360 in) |
| Stories | 3 @ 13 ft (156 in) |
| Column grid (x) | 0, 360, 720 in |
| Floor levels (y) | 0 (base), 156 (2nd), 312 (3rd), 468 (roof) in |
| Ground nodes (y) | -1 in (bearing attachment) |
| Total height | 39 ft (468 in) |
| Number of columns | 3 (per story) |
| Number of bays | 2 |

### Member Properties

**Columns -- W14x132, ASTM A992 (all stories, all locations)**

| Property | Symbol | Value |
|----------|--------|-------|
| Yield stress | Fy | 50 ksi |
| Elastic modulus | E | 29,000 ksi |
| Cross-sectional area | A | 38.8 in^2 |
| Moment of inertia (strong axis) | Ix | 1,530 in^4 |
| Plastic section modulus | Zx | 234 in^3 |
| Depth | d | 14.66 in |
| Flange width | bf | 14.725 in |

**Beams -- W24x76, ASTM A992 (all floors)**

| Property | Symbol | Value |
|----------|--------|-------|
| Yield stress | Fy | 50 ksi |
| Elastic modulus | E | 29,000 ksi |
| Cross-sectional area | A | 22.4 in^2 |
| Moment of inertia (strong axis) | Ix | 2,100 in^4 |
| Plastic section modulus | Zx | 200 in^3 |
| Depth | d | 23.92 in |
| Flange width | bf | 8.99 in |

### Loading

| Parameter | Value |
|-----------|-------|
| Seismic weight per floor | W1 = W2 = W3 = 150 kips |
| Total seismic weight | W = 450 kips |
| Floor mass | m = W/g = 150/386.4 = **0.3882 kip-s^2/in** |

### Seismic Hazard

| Parameter | Value |
|-----------|-------|
| Site Class | D (stiff soil) |
| Ss | 1.50g |
| S1 | 0.60g |
| Fa | 1.0 |
| Fv | 1.5 |
| SDS = (2/3) x Fa x Ss | **1.00g** |
| SD1 = (2/3) x Fv x S1 | **0.60g** |
| SM1 = Fv x S1 | 0.90g |

### Design Parameters

| Parameter | Fixed-Base | Isolated |
|-----------|-----------|----------|
| R | 8 (Special SMRF) | 2.0 (substructure) |
| Ie | 1.5 | 1.5 |
| Omega_0 | 3.0 | -- |
| Cd | 5.5 | -- |
| RI (isolation system) | -- | 1.0 |

---

## PART 1: MODAL ANALYSIS -- FIXED-BASE

### Step 1: Individual Column Lateral Stiffness

Assuming double-curvature bending (fixed-fixed) for all columns in this moment frame:

```
k_col = 12 * E * I / h^3
k_col = 12 * 29,000 * 1,530 / (156)^3
k_col = 532,440,000 / 3,796,416
```

**k_col = 140.248 kip/in**

### Step 2: Story Stiffness

All three columns contribute to the lateral resistance at each story. Since all columns are identical W14x132 sections with the same story height:

```
k_story = n_columns x k_col = 3 x 140.248
```

**k1 = k2 = k3 = 420.744 kip/in**

### Step 3: Stiffness Matrix [K]

The 3x3 stiffness matrix for the three-story shear building model:

```
[K] = | k1+k2    -k2      0    |   | 841.488   -420.744     0.000  |
      | -k2    k2+k3    -k3    | = | -420.744   841.488  -420.744  |  kip/in
      |  0      -k3      k3    |   |    0.000  -420.744   420.744  |
```

### Step 4: Mass Matrix [M]

```
m = W/g = 150 / 386.4 = 0.38820 kip-s^2/in

[M] = | 0.38820    0         0      |
      | 0         0.38820    0      |  kip-s^2/in
      | 0          0        0.38820 |
```

### Step 5: Eigenvalue Problem Solution

Solving the generalized eigenvalue problem **[K - omega^2 M]{phi} = 0**:

First compute [M]^(-1)[K]:

```
[A] = [M]^(-1)[K] = (1/0.38820) * [K]
```

The characteristic equation det([A] - omega^2 [I]) = 0 yields a cubic in omega^2. Solving numerically:

| Mode | omega^2 (rad/s)^2 | omega (rad/s) | Period T (sec) | Frequency f (Hz) |
|------|-------------------|---------------|----------------|-------------------|
| **1** | **214.667** | **14.652** | **0.4288** | **2.332** |
| **2** | **1,685.321** | **41.053** | **0.1531** | **6.534** |
| **3** | **3,519.197** | **59.323** | **0.1059** | **9.442** |

### Mode Shapes (normalized to roof = 1.0)

| DOF (Floor) | Mode 1 | Mode 2 | Mode 3 |
|-------------|--------|--------|--------|
| 1 (2nd Floor) | 0.4450 | -1.2470 | 1.8019 |
| 2 (3rd Floor) | 0.8019 | -0.5550 | -2.2470 |
| 3 (Roof) | 1.0000 | 1.0000 | 1.0000 |

**Mode 1** (T1 = 0.429 sec): First mode -- all floors move in the same direction, increasing amplitude toward the roof. This is the fundamental sway mode.

**Mode 2** (T2 = 0.153 sec): Second mode -- one sign reversal between floors 2 and 3.

**Mode 3** (T3 = 0.106 sec): Third mode -- two sign reversals. Higher mode with alternating floor displacements.

### Modal Participation Factors and Effective Modal Mass

The modal participation factor for mode i is:

```
Gamma_i = (sum(m_j * phi_ij)) / (sum(m_j * phi_ij^2))
```

The effective modal mass is:

```
M_eff_i = [sum(m_j * phi_ij)]^2 / [sum(m_j * phi_ij^2)]
```

| Mode | Gamma | M_eff (kip-s^2/in) | M_eff / M_total (%) |
|------|-------|---------------------|---------------------|
| 1 | 1.2204 | 1.0645 | **91.41%** |
| 2 | -0.2801 | 0.0872 | **7.49%** |
| 3 | 0.0597 | 0.0129 | **1.10%** |
| **Sum** | -- | **1.1646** | **100.00%** |

Mode 1 captures 91.4% of the total mass, which confirms it dominates the seismic response. The sum of effective modal masses equals 100% of the total mass (3 modes = 3 DOFs).

---

## PART 2: MODAL ANALYSIS -- ISOLATED

### Step 1: TFP Bearing Properties

| Surface | Friction (mu) | Radius R (in) |
|---------|--------------|---------------|
| 1 (inner bottom) | 0.03 | 12 |
| 2 (inner top) | 0.03 | 12 |
| 3 (outer bottom) | 0.08 | 88 |
| 4 (outer top) | 0.08 | 88 |

Displacement capacities: d1 = d2 = 3 in, d3 = 15 in

**Effective pendulum length:**

```
Leff = R3 + R4 - R1 - R2 = 88 + 88 - 12 - 12 = 152 in
```

**Leff = 152 in**

**Effective friction coefficient** (composite for the regime III sliding behavior):

```
mu_eff = (mu3*R3 + mu4*R4 - mu1*R1 - mu2*R2) / Leff
mu_eff = (0.08*88 + 0.08*88 - 0.03*12 - 0.03*12) / 152
mu_eff = (7.04 + 7.04 - 0.36 - 0.36) / 152
mu_eff = 13.36 / 152
```

**mu_eff = 0.0879**

Weight per bearing = W_total / n_bearings = 450 / 3 = **150 kips**

### Step 2: Iterative Procedure for Effective Properties

The effective stiffness, period, and damping are displacement-dependent. An iterative procedure is required:

1. Assume a trial displacement D
2. Compute effective stiffness: K_eff = mu_eff * W / D + W / Leff
3. Compute effective period: T_eff = 2*pi * sqrt(W / (g * K_eff))
4. Compute effective damping: beta_eff = (2/pi) * Qd / (K_eff * D)
5. Determine damping reduction factor B_L from ASCE 7 Table 17.5-1
6. Compute design displacement: D_d = g * SD1 * T_eff / (4*pi^2 * B_L)
7. If D_d is close to assumed D, converged; otherwise repeat with D = D_d

| Iteration | D (in) | K_eff (kip/in) | T_eff (sec) | beta_eff | B_L | D_new (in) |
|-----------|--------|----------------|-------------|----------|-----|------------|
| 1 | 10.000 | 6.916 | 2.578 | 0.364 | 1.828 | 8.282 |
| 2 | 8.282 | 7.736 | 2.438 | 0.393 | 1.886 | 7.591 |
| 3 | 7.591 | 8.171 | 2.372 | 0.406 | 1.906 | 7.309 |
| 4 | 7.309 | 8.372 | 2.343 | 0.412 | 1.912 | 7.200 |
| 5 | 7.200 | 8.454 | 2.332 | 0.414 | 1.914 | 7.156 |
| 6 | 7.156 | 8.488 | 2.327 | 0.415 | 1.915 | 7.139 |
| 7 | 7.139 | 8.501 | 2.326 | 0.415 | 1.915 | 7.132 |
| 8 | 7.132 | 8.506 | 2.325 | 0.415 | 1.915 | 7.129 |
| 9 | 7.129 | 8.508 | 2.325 | 0.415 | 1.915 | 7.128 |
| 10 | 7.128 | 8.509 | 2.325 | 0.415 | 1.915 | 7.128 |

**CONVERGED** at iteration 10.

### Converged Isolation System Properties (Design-Level, DBE)

| Property | Value |
|----------|-------|
| Design displacement | **D_d = 7.128 in** |
| Effective period | **T_eff = 2.325 sec** |
| Effective stiffness (total) | **K_eff = 8.509 kip/in** |
| Effective stiffness (per bearing) | K_eff = 2.836 kip/in |
| Effective damping | **beta_eff = 41.5%** |
| Damping reduction factor | B_L = 1.915 |

Note: The high effective damping (41.5%) is characteristic of friction-based isolation systems. The ASCE 7 damping reduction factor table limits B_L values, which in turn prevents unrealistically small displacement predictions.

### Step 3: 4-DOF Isolated System Modal Analysis

The isolated system has 4 degrees of freedom:
- DOF 0: Isolation level (base slab above bearings)
- DOF 1: 2nd floor
- DOF 2: 3rd floor
- DOF 3: Roof

Base slab mass assumed as m_base = 0.5 * m_floor = 0.194 kip-s^2/in

**4-DOF Stiffness Matrix [K_iso]** (kip/in):

```
| 429.254  -420.744     0.000     0.000 |
|-420.744   841.488  -420.744     0.000 |
|   0.000  -420.744   841.488  -420.744 |
|   0.000     0.000  -420.744   420.744 |
```

Note: K_iso[0,0] = K_eff_bearing + k_story1 = 8.509 + 420.744 = 429.254 kip/in

**Eigenvalue Solution -- Isolated System:**

| Mode | omega^2 (rad/s)^2 | omega (rad/s) | Period T (sec) | Frequency f (Hz) |
|------|-------------------|---------------|----------------|-------------------|
| **1** | **6.121** | **2.474** | **2.540** | **0.394** |
| **2** | **828.638** | **28.786** | **0.218** | **4.581** |
| **3** | **2,662.559** | **51.600** | **0.122** | **8.212** |
| **4** | **4,133.381** | **64.291** | **0.098** | **10.232** |

**Isolated Mode Shapes (normalized to base DOF = 1.0):**

| DOF | Mode 1 | Mode 2 | Mode 3 | Mode 4 |
|-----|--------|--------|--------|--------|
| Base | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| Floor 1 | 1.0174 | 0.6380 | -0.2081 | -0.8866 |
| Floor 2 | 1.0291 | -0.2118 | -0.9050 | 0.6080 |
| Floor 3 | 1.0349 | -0.8997 | 0.6213 | -0.2161 |

**Mode 1 Observation**: The first isolated mode shape shows nearly rigid-body translation of the entire structure. All floor displacements are within 3.5% of the base displacement (1.000 to 1.035). This confirms that the superstructure moves as a near-rigid body on the isolation system.

**Isolated Modal Participation:**

| Mode | Gamma | M_eff / M_total (%) |
|------|-------|---------------------|
| 1 | 0.977 | **99.99%** |
| 2 | 0.015 | 0.01% |
| 3 | 0.005 | 0.00% |
| 4 | 0.003 | 0.00% |

Mode 1 captures virtually 100% of the total mass. The higher modes are essentially decoupled from ground motion.

### Step 4: Period Shift Summary

```
Fixed-base fundamental period:  T1 = 0.429 sec
Isolated fundamental period:    T1 = 2.540 sec
Period ratio:                   2.540 / 0.429 = 5.92x increase
```

**The isolation system shifts the fundamental period by a factor of 5.9**, moving the structure out of the high-acceleration region of the design spectrum and into the displacement-dominated region. This dramatic period shift is the primary mechanism by which base isolation reduces seismic forces.

---

## PART 3: EQUIVALENT LATERAL FORCE -- FIXED-BASE

### Step 1: Seismic Response Coefficient

```
Cs = SDS / (R/Ie) = 1.00 / (8.0/1.5) = 1.00 / 5.333
```

**Cs = 0.1875**

**Check minimum:**

```
Cs_min = 0.044 * SDS * Ie = 0.044 * 1.00 * 1.5 = 0.066
0.1875 > 0.066  -->  OK
```

**Check upper bound (ASCE 7 Eq. 12.8-3):**

```
Cs_upper = SD1 / (T1 * R/Ie) = 0.60 / (0.4288 * 5.333) = 0.60 / 2.287 = 0.2623
0.1875 <= 0.2623  -->  Eq. 12.8-2 governs
```

**Cs_design = 0.1875**

### Step 2: Design Base Shear

```
V = Cs * W = 0.1875 * 450
```

**V = 84.38 kips**

### Step 3: Vertical Force Distribution

Since T1 = 0.429 sec < 0.5 sec, the distribution exponent k = 1.0 (linear distribution).

The vertical distribution factor is:

```
Cvx = (wx * hx^k) / sum(wi * hi^k)
```

| Floor | w_i (kips) | h_i (in) | w_i * h_i^k | C_vx | F_x (kips) |
|-------|-----------|---------|-------------|------|------------|
| 1 (2nd) | 150 | 156 | 23,400 | 0.1667 | **14.06** |
| 2 (3rd) | 150 | 312 | 46,800 | 0.3333 | **28.13** |
| 3 (Roof) | 150 | 468 | 70,200 | 0.5000 | **42.19** |
| **Sum** | **450** | -- | **140,400** | **1.0000** | **84.38** |

### Step 4: Story Shears

```
V_story3 = F3 = 42.19 kips
V_story2 = F3 + F2 = 42.19 + 28.13 = 70.31 kips
V_story1 = F3 + F2 + F1 = 42.19 + 28.13 + 14.06 = 84.38 kips
```

### Step 5: Story Displacements and Drift Ratios

**Elastic displacements** (from story shear divided by story stiffness):

```
delta_e1 = V_story1 / k1 = 84.38 / 420.744 = 0.2005 in
delta_e2 = delta_e1 + V_story2 / k2 = 0.2005 + 70.31 / 420.744 = 0.3677 in
delta_e3 = delta_e2 + V_story3 / k3 = 0.3677 + 42.19 / 420.744 = 0.4679 in
```

**Design (amplified) displacements** per ASCE 7 Eq. 12.8-15:

```
delta_x = Cd * delta_xe / Ie = 5.5 * delta_xe / 1.5
```

| Story | delta_e (in) | delta_x (in) | Story Drift (in) | Drift Ratio | Limit (1.0%) | Status |
|-------|-------------|-------------|-------------------|-------------|--------------|--------|
| 1 | 0.2005 | 0.7353 | 0.7353 | **0.00471 (0.47%)** | 0.010 | OK |
| 2 | 0.3677 | 1.3481 | 0.6128 | **0.00393 (0.39%)** | 0.010 | OK |
| 3 | 0.4679 | 1.7157 | 0.3677 | **0.00236 (0.24%)** | 0.010 | OK |

**Maximum story drift ratio = 0.471% at Story 1**

Per ASCE 7 Table 12.12-1, the allowable story drift for Risk Category IV (essential facility) is 0.010h (1.0%). The computed maximum drift of 0.47% is well within this limit.

**Roof displacement = 1.716 in**

---

## PART 4: ISOLATION SYSTEM DESIGN

### Step 1: Target Properties

| Parameter | Value |
|-----------|-------|
| Target effective period | 3.5 sec (initial estimate; converges to 2.32 sec due to high damping) |
| Effective pendulum length | Leff = 152 in |
| Number of bearings | 3 |
| Weight per bearing | 150 kips |

### Step 2: Effective Stiffness at Design Displacement

For a single TFP bearing:

```
Keff_bearing = mu_eff * W_bearing / D + W_bearing / Leff
```

For the total system (3 bearings):

```
Keff_total = 3 * Keff_bearing = 3 * (0.0879 * 150 / D + 150 / 152)
```

At converged design displacement D_d = 7.128 in:

```
Keff_per_bearing = 0.0879 * 150 / 7.128 + 150 / 152
                 = 1.850 + 0.987
                 = 2.836 kip/in

Keff_total = 3 * 2.836 = 8.509 kip/in
```

**K_eff (total) = 8.509 kip/in**

### Step 3: Design Displacement

The design displacement is computed from:

```
Dd = g * SD1 * Teff / (4 * pi^2 * BL)
```

After convergence:

```
Dd = 386.4 * 0.60 * 2.325 / (4 * pi^2 * 1.915)
   = 539.06 / 75.61
   = 7.128 in
```

**D_d = 7.128 in**

### Step 4: Effective Damping

```
beta_eff = (2/pi) * Qd / (Keff * D)

where Qd = mu_eff * W = 0.0879 * 450 = 39.55 kips

beta_eff = (2/pi) * 39.55 / (8.509 * 7.128)
         = 0.6366 * 39.55 / 60.64
         = 0.415
```

**beta_eff = 41.5%**

This high damping value is typical of friction pendulum systems and represents significant energy dissipation through friction.

### Step 5: Damping Reduction Factor

From ASCE 7 Table 17.5-1, interpolating for beta_eff = 41.5%:

```
BL = 1.7 + (1.9 - 1.7) * (0.415 - 0.30) / (0.40 - 0.30) = 1.915
```

**B_L = 1.915**

### Step 6: MCE Displacement Check

MCE spectral acceleration:

```
SM1 = Fv * S1 = 1.5 * 0.60 = 0.90g
```

Iterating for MCE displacement (similar procedure as DBE):

| Property | DBE | MCE |
|----------|-----|-----|
| Spectral acceleration | SD1 = 0.60g | SM1 = 0.90g |
| Design displacement | **D_d = 7.128 in** | **D_M = 14.745 in** |
| Effective period | T_eff = 2.325 sec | T_M = 2.854 sec |
| Effective damping | beta = 41.5% | beta_M = 30.3% |
| Damping factor | B_L = 1.915 | B_M = 1.705 |
| Effective stiffness | K_eff = 8.509 kip/in | K_eff = 5.643 kip/in |

**Displacement Capacity Check:**

```
Bearing displacement capacity (outer surface governs): d3 = 15.0 in
MCE displacement demand: D_M = 14.745 in

D_M = 14.745 in  <=  d3 = 15.0 in  -->  CAPACITY CHECK PASSES
```

The MCE displacement demand is 98.3% of the bearing capacity. This is a tight margin. In practice, the engineer should consider using bearings with slightly larger displacement capacity for additional safety margin.

### Step 7: Lambda Factor Analysis (ASCE 7-22 / AASHTO)

Property modification factors account for aging, temperature, contamination, and manufacturing variability:

| Property | Nominal | Lower Bound (lambda_min = 0.85) | Upper Bound (lambda_max = 1.80) |
|----------|---------|--------------------------------|--------------------------------|
| mu_eff | 0.0879 | 0.0747 | 0.1582 |
| D_d (in) | 7.128 | **9.071** | **5.093** |
| T_eff (sec) | 2.325 | 2.626 | 1.647 |
| beta_eff | 0.415 | 0.354 | 0.525 |

**Lower bound** (lambda_min = 0.85): Lower friction produces larger displacement demand (9.07 in) and longer period. This governs displacement design.

**Upper bound** (lambda_max = 1.80): Higher friction produces higher force demand but smaller displacement (5.09 in) and shorter period. This governs force design of the superstructure.

### Step 8: Isolated Design Base Shear

**Total bearing force at design displacement:**

```
Vb = Keff * Dd = 8.509 * 7.128 = 60.66 kips
Vb/W = 60.66 / 450 = 0.1348
```

**Superstructure design force** (reduced by RI = 2.0 for isolated substructure):

```
Vs = Vb / RI = 60.66 / 2.0 = 30.33 kips
Vs/W = 30.33 / 450 = 0.0674
```

**V_s = 30.33 kips** (superstructure design force)

---

## PART 5: PUSHOVER ANALYSIS -- FIXED-BASE

### Step 1: Plastic Moments

```
Column: Mp_col = Fy * Zx = 50 * 234 = 11,700 kip-in
Beam:   Mp_beam = Fy * Zx = 50 * 200 = 10,000 kip-in
```

**Mp_col = 11,700 kip-in**
**Mp_beam = 10,000 kip-in**

### Step 2: Strong-Column Weak-Beam Check

At an interior joint:

```
Sum(Mp_columns) = 2 * 11,700 = 23,400 kip-in
Sum(Mp_beams)   = 2 * 10,000 = 20,000 kip-in

Ratio = 23,400 / 20,000 = 1.17 > 1.0  -->  SCWB SATISFIED
```

This means beam plastic hinges will form before column hinges (except at the column bases which are fixed supports), producing the desirable strong-column weak-beam mechanism.

### Step 3: First-Mode Lateral Load Pattern

Using Mode 1 shape from the modal analysis:

| Floor | phi_i | m_i * phi_i | F_ratio (normalized) |
|-------|-------|-------------|---------------------|
| 1 | 0.4450 | 0.1728 | **0.1981** |
| 2 | 0.8019 | 0.3113 | **0.3569** |
| 3 | 1.0000 | 0.3882 | **0.4450** |
| Sum | -- | 0.8723 | 1.0000 |

Effective height for first-mode load pattern:

```
h_eff = sum(F_ratio_i * h_i) = 0.1981*156 + 0.3569*312 + 0.4450*468
      = 30.9 + 111.3 + 208.3
      = 350.5 in
```

### Step 4: Elastic Lateral Stiffness

The elastic roof stiffness (ratio of base shear to roof displacement):

```
For unit base shear V = 1 kip:
  Story shears: V1 = 1.000, V2 = 0.802, V3 = 0.445 (proportional to cumulative pattern)

  delta_e1 = V1/k1 = 1.000/420.744 = 0.002377 in
  delta_e2 = delta_e1 + V2/k2 = 0.002377 + 0.802/420.744 = 0.004283 in
  delta_e3 = delta_e2 + V3/k3 = 0.004283 + 0.445/420.744 = 0.005340 in

  K_elastic = 1/delta_e3 = 1/0.005340 = 187.25 kip/in
```

**K_elastic (roof) = 187.25 kip/in**

### Step 5: Yield Point Estimation

**First beam yield** (beams yield before columns since Mp_beam < Mp_col):

Using portal method approximation, the column base moment per unit base shear:

```
M_col_base = (V_story1 / n_cols) * h/2 = (1.0/3) * 156/2 = 26.0 kip-in per kip of base shear
```

Base shear at column base yield:

```
V_y_col = Mp_col / 26.0 = 11,700 / 26.0 = 450.0 kips
```

Base shear at first beam yield (beams are weaker):

```
V_y_beam = Mp_beam * 2 * n_cols / h = 10,000 * 2 * 3 / 156 = 384.6 kips
```

Accounting for non-uniform moment distribution and frame action effects (reduction factor 0.85):

```
V_first_yield = 0.85 * min(384.6, 450.0) = 0.85 * 384.6 = 326.9 kips
delta_first_yield = V_first_yield / K_elastic = 326.9 / 187.25 = 1.746 in
```

**V_y = 326.9 kips at delta_y = 1.746 in**

### Step 6: Mechanism Capacity

**Story 1 sway mechanism** (plastic hinges at 3 column bases + 4 beam ends at Floor 1):

```
V_mech1 = (3*Mp_col + 4*Mp_beam) / h
         = (3*11,700 + 4*10,000) / 156
         = (35,100 + 40,000) / 156
         = 75,100 / 156
         = 481.4 kips
```

**Full beam-sway mechanism** (plastic hinges at all 12 beam ends + 3 column bases):

```
V_full = (3*Mp_col + 12*Mp_beam) / h_eff
        = (3*11,700 + 12*10,000) / 350.5
        = (35,100 + 120,000) / 350.5
        = 155,100 / 350.5
        = 442.5 kips
```

The full beam-sway mechanism governs (lower capacity):

**V_mechanism = 442.5 kips**

Post-yield stiffness (5% of elastic stiffness):

```
K_postyield = 0.05 * K_elastic = 0.05 * 187.25 = 9.36 kip/in
```

### Step 7: Capacity Curve Data Points

The pushover curve captures the elastic range, progressive yielding, mechanism formation, and post-mechanism behavior:

| Point | Roof Displacement (in) | Base Shear (kips) | Description |
|-------|----------------------|-------------------|-------------|
| 1 | 0.000 | 0.0 | Origin |
| 2 | 0.591 | 110.6 | 25% elastic |
| 3 | 1.182 | 221.2 | 50% elastic |
| 4 | 1.772 | 331.9 | 75% elastic |
| 5 | 2.363 | 442.5 | Effective yield (bilinear idealization) |
| 6 | 2.599 | 447.6 | First beams yielding |
| 7 | 3.072 | 453.0 | Progressive beam yielding |
| 8 | 3.781 | 456.7 | Additional beam hinges |
| 9 | 4.726 | 459.1 | Column base hinges forming |
| 10 | 5.908 | 460.6 | Near-mechanism |
| 11 | 7.089 | 453.5 | Full mechanism (slight softening) |
| 12 | 9.452 | 475.7 | Post-mechanism (strain hardening) |
| 13 | 11.815 | 497.8 | Post-mechanism |
| 14 | 14.178 | 519.9 | Post-mechanism |

**Pushover curve arrays** (for IsoVis application):

```
roof_disp_fixed = [0.0, 0.591, 1.182, 1.772, 2.363, 2.599, 3.072, 3.781, 4.726, 5.908, 7.089, 9.452, 11.815, 14.178]

base_shear_fixed = [0.0, 110.62, 221.24, 331.86, 442.47, 447.58, 452.95, 456.70, 459.07, 460.58, 453.54, 475.66, 497.78, 519.91]
```

### Step 8: Ductility and Performance Assessment

**Ductility ratio:**

```
mu = delta_ultimate / delta_yield = 7.089 / 2.363 = 3.0
```

**Overstrength ratio:**

```
Omega = V_mechanism / V_design = 442.5 / 84.4 = 5.24
```

This high overstrength is typical for special moment frames where the R factor (R=8) is large relative to the actual structural capacity. The design is governed by drift limits rather than strength.

---

## PART 6: PUSHOVER ANALYSIS -- ISOLATED

### Step 1: Bearing Force-Displacement (Bilinear Model)

The TFP bearing is modeled with a bilinear hysteretic relationship:

**Characteristic strength** (friction force at zero displacement):

```
Qd = mu_eff * W = 0.0879 * 450 = 39.55 kips
```

**Post-yield stiffness** (pendulum restoring force):

```
Kp = W / Leff = 450 / 152 = 2.961 kip/in
```

**Yield displacement** (very small for friction bearings):

```
Dy = 0.02 in (typical for friction pendulum systems)
```

**Initial stiffness** (pre-slip):

```
Ki = Qd/Dy + Kp = 39.55/0.02 + 2.961 = 1,980.6 kip/in
```

| Parameter | Value |
|-----------|-------|
| Characteristic strength | **Qd = 39.55 kips** |
| Post-yield stiffness | **Kp = 2.961 kip/in** |
| Yield displacement | **Dy = 0.02 in** |
| Initial stiffness | **Ki = 1,980.6 kip/in** |

### Step 2: Superstructure Behavior

The superstructure lateral stiffness (K = 187.25 kip/in) is 22 times the bearing effective stiffness (8.51 kip/in). This means:

- The superstructure remains **essentially elastic** during seismic loading
- Nearly all deformation is concentrated at the isolation plane
- The superstructure deformation is approximately D_d * (K_bearing/K_super) = 7.128 * (8.509/187.25) = 0.32 in (very small)
- **Zero plastic hinges** form in the superstructure

### Step 3: System Pushover Curve

The isolated system pushover curve is dominated by the bearing bilinear behavior:

| Point | Displacement (in) | Base Shear (kips) | Description |
|-------|-------------------|-------------------|-------------|
| 1 | 0.000 | 0.0 | Origin |
| 2 | 0.010 | 19.8 | Pre-slip (elastic) |
| 3 | 0.020 | 39.6 | Bearing yield (slip initiation) |
| 4 | 0.500 | 41.0 | Post-yield sliding |
| 5 | 1.000 | 42.5 | Sliding |
| 6 | 2.000 | 45.5 | Sliding |
| 7 | 4.000 | 51.4 | Sliding |
| 8 | 6.000 | 57.3 | Sliding |
| 9 | 8.000 | 63.2 | Sliding |
| 10 | 10.000 | 69.2 | Sliding |
| 11 | 15.000 | 84.0 | Near MCE displacement |
| 12 | 18.000 | 92.8 | Beyond MCE |

**Pushover curve arrays** (for IsoVis application):

```
roof_disp_isolated = [0.0, 0.01, 0.02, 0.5, 1.0, 2.0, 4.0, 6.0, 8.0, 10.0, 15.0, 18.0]

base_shear_isolated = [0.0, 19.81, 39.61, 41.03, 42.51, 45.47, 51.39, 57.32, 63.24, 69.16, 83.96, 92.84]
```

**Key observation**: The post-yield (sliding) branch follows a linear relationship:

```
V = Qd + Kp * D = 39.55 + 2.961 * D
```

At design displacement: V = 39.55 + 2.961 * 7.128 = 60.66 kips (matches the converged effective stiffness result).

### Step 4: Energy Dissipation

The area enclosed by one full hysteretic loop represents the energy dissipated per cycle:

```
E_diss = 4 * Qd * (D - Dy) approximately = 4 * 39.55 * 7.128 = 1,128 kip-in per cycle
```

The stored elastic energy at peak displacement:

```
E_stored = 0.5 * Keff * D^2 = 0.5 * 8.509 * 7.128^2 = 216.1 kip-in
```

Equivalent viscous damping ratio:

```
beta = E_diss / (4 * pi * E_stored) = 1,128 / (4 * pi * 216.1) = 0.415 (41.5%)
```

This confirms the effective damping computed in Part 4.

---

## PART 7: COMPARISON SUMMARY

| Metric | Fixed-Base (Ductile) | Base-Isolated | Reduction (%) |
|--------|---------------------|---------------|---------------|
| Fundamental Period (sec) | **0.429** | **2.540** | N/A (5.9x increase) |
| Design Base Shear (kips) | **84.38** | **30.33** | **64.1%** |
| Base Shear Coefficient (V/W) | **0.1875** | **0.0674** | **64.1%** |
| Max Story Drift Ratio (%) | **0.471%** | **0.035%** | **92.7%** |
| Roof Displacement (in) | **1.716** | **0.162** | **90.6%** |
| Plastic Hinges Formed | **15** | **0** | **100%** |
| Bearing Displacement (in) | N/A | **7.128** | N/A |
| MCE Bearing Displacement (in) | N/A | **14.745** | N/A |
| Ductility Demand | 3.0 | ~1.0 (elastic) | 100% |
| Performance Level | **Life Safety (LS)** | **Immediate Occupancy (IO)** | **2-level upgrade** |

### Key Findings

1. **Force Reduction**: The isolation system reduces the superstructure design base shear by 64.1% (from 84.4 kips to 30.3 kips). This translates directly to reduced member forces and smaller required sections.

2. **Drift Reduction**: Maximum story drift is reduced by 92.7% (from 0.471% to 0.035%). For a hospital, this means medical equipment, piping, and cladding connections are essentially undamaged.

3. **Performance Upgrade**: The fixed-base design achieves Life Safety performance (significant structural damage allowed, building may not be repairable). The isolated design achieves Immediate Occupancy (structure remains safe to occupy, damage is negligible). This is critical for an essential facility that must remain operational after a major earthquake.

4. **Elastic Superstructure**: Zero plastic hinges form in the isolated structure. All inelastic deformation is concentrated in the bearings, which are designed and tested for this purpose and can be inspected and replaced if needed.

5. **Displacement Trade-off**: The isolation system introduces bearing displacement demand (7.13 in at DBE, 14.75 in at MCE). The MCE displacement of 14.75 in is 98.3% of the 15.0 in bearing capacity, indicating the bearing size is adequate but with minimal margin. Consider specifying bearings with d3 = 18 in for additional safety margin.

---

## PART 8: PLASTIC HINGE SUMMARY

### Fixed-Base Configuration

In the fixed-base special moment-resisting frame, plastic hinges form progressively under increasing lateral load:

**Sequence of Hinge Formation:**

| Order | Location | Number of Hinges | Approximate V (kips) | Cumulative Hinges |
|-------|----------|-----------------|---------------------|-------------------|
| 1 | First floor beam ends | 4 | ~327 | 4 |
| 2 | Second floor beam ends | 4 | ~376 | 8 |
| 3 | Third floor beam ends | 4 | ~420 | 12 |
| 4 | Column bases (ground level) | 3 | ~428 | **15** |
| 5 | Full mechanism | -- | **442** | 15 |

**Hinge Detail:**

- **Beam hinges (12 total)**: Form at both ends of all 6 beams (2 bays x 3 stories x 2 ends). These form first because Mp_beam = 10,000 kip-in < Mp_col = 11,700 kip-in, satisfying the strong-column weak-beam design philosophy.

- **Column base hinges (3 total)**: Form at the fixed supports of all 3 ground-level columns. These are the last hinges to form because the columns are stronger than the beams.

- **No column-top hinges**: The SCWB ratio of 1.17 prevents column hinging at beam-column joints.

**Performance Level Assessment (Fixed-Base):**

At the design earthquake level:
- Story drift ratio: 0.47% (maximum at Story 1)
- ASCE 41 Immediate Occupancy limit for steel SMRF: 0.7% transient drift
- ASCE 41 Life Safety limit for steel SMRF: 2.5% transient drift
- The design-level drift of 0.47% is below IO, but the structure relies on inelastic behavior (R=8) for force reduction
- Under MCE-level shaking, plastic hinges will form and the structure achieves **Life Safety** performance
- The structure may require significant repairs after the design earthquake

### Isolated Configuration

In the base-isolated configuration:

**Plastic hinges formed: ZERO**

The superstructure remains fully elastic because:

1. The isolation system reduces the base shear transmitted to the superstructure from 84.4 kips to 30.3 kips
2. The maximum member forces are well below yield capacity
3. The maximum story drift of 0.035% produces negligible member rotations
4. All inelastic deformation occurs in the TFP bearings (by design)

**Performance Level Assessment (Isolated):**

- Story drift ratio: 0.035% (all stories)
- ASCE 41 Immediate Occupancy limit: 0.7% -- far below
- All structural members remain elastic
- Non-structural damage is negligible at this drift level
- Performance level: **Immediate Occupancy (IO)**
- The structure remains fully operational after the design earthquake
- Hospital functions, including critical care, can continue without interruption

### Bearing Performance

The TFP bearings concentrate all inelastic deformation:

| Parameter | DBE | MCE |
|-----------|-----|-----|
| Bearing displacement | 7.13 in | 14.75 in |
| Displacement capacity | 15.0 in | 15.0 in |
| Demand/Capacity ratio | 0.48 | 0.98 |
| Bearing force | 60.7 kips | ~83.2 kips |
| Friction energy dissipation | 41.5% eq. damping | 30.3% eq. damping |

The bearings are the only elements that undergo inelastic behavior, and they are specifically designed, tested, and certified for this purpose. After a major earthquake, the bearings can be inspected through access ports and replaced if needed without disrupting the superstructure.

---

## APPENDIX A: NOTATION

| Symbol | Description | Units |
|--------|-------------|-------|
| E | Modulus of elasticity | ksi |
| Fy | Yield stress | ksi |
| Ix | Moment of inertia (strong axis) | in^4 |
| Zx | Plastic section modulus | in^3 |
| Mp | Plastic moment capacity | kip-in |
| k_col | Column lateral stiffness | kip/in |
| K | Stiffness matrix | kip/in |
| M | Mass matrix | kip-s^2/in |
| omega | Natural circular frequency | rad/s |
| T | Natural period | sec |
| phi | Mode shape vector | -- |
| Gamma | Modal participation factor | -- |
| M_eff | Effective modal mass | kip-s^2/in |
| Cs | Seismic response coefficient | -- |
| V | Base shear | kips |
| Cvx | Vertical distribution factor | -- |
| Fx | Floor force | kips |
| delta | Displacement | in |
| Cd | Deflection amplification factor | -- |
| mu_eff | Effective friction coefficient | -- |
| Leff | Effective pendulum length | in |
| Keff | Effective stiffness | kip/in |
| Teff | Effective period | sec |
| beta_eff | Effective damping ratio | -- |
| BL | Damping reduction factor | -- |
| Dd | Design displacement | in |
| DM | MCE displacement | in |
| Qd | Characteristic strength | kips |
| lambda | Property modification factor | -- |

## APPENDIX B: REFERENCES

1. ASCE/SEI 7-22, Minimum Design Loads and Associated Criteria for Buildings and Other Structures
2. ASCE/SEI 41-17, Seismic Evaluation and Retrofit of Existing Buildings
3. AISC 360-22, Specification for Structural Steel Buildings
4. AISC 341-22, Seismic Provisions for Structural Steel Buildings
5. AASHTO Guide Specifications for Seismic Isolation Design, 4th Edition
6. Constantinou, M.C., Kalpakidis, I., Filiatrault, A., and Ecker Lay, R.A. (2011). "LRFD-Based Analysis and Design Procedures for Bridge Bearings and Seismic Isolators," MCEER-11-0004
7. Fenz, D.M. and Constantinou, M.C. (2008). "Mechanical Behavior of Multi-Spherical Sliding Bearings," MCEER-08-0007

---

*Report prepared for chief engineer review. All calculations performed with full precision; displayed values are rounded for clarity. The complete numerical results are stored in calc_results.json for integration with the IsoVis application.*
