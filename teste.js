C3 = B + (B - C2)*be
C5 = C + (C - C4)*be
C7 = D + (D - C6)*be
C4 = B + (B - C2)*(2*be+be**2+bee/2) + (C1-C2)*be**2
C6 = C + (C - C6)*(2*be+be**2+bee/2) + (C3-C4)*be**2
C8 = D + (D - I)*(2*be+be**2+bee/2) + (C5-C6)*be**2
be = 0.5
bee = -0.5

A A
B C1
C C2
D B
E C3
F C4
G C
H C5
I C6
J D
K C7
L C8
M E
