# Techonest pilot model — all inputs are estimates unless noted
FEES=0.05     # ticketing platform fee, share of gross (est.)
SACEM=0.08    # SACEM placeholder, share of gross (est., quote needed)
CNM=0.035     # CNM tax, share of ticket receipts excl. VAT (legal rate; applicability to confirm)
def per_ticket_net(price, vat):
    ht = price/(1+vat)
    return price - (price-ht) - FEES*price - SACEM*price - CNM*ht
def night(name,t,p,vat,venue,n_paid,pay,sec,mkt,ins,gear):
    gross=t*p; ht=gross/(1+vat); vatamt=gross-ht
    fees=FEES*gross; sac=SACEM*gross; cnm=CNM*ht
    net=gross-vatamt-fees-sac-cnm
    staff=n_paid*pay
    fixed=venue+staff+sec+mkt+ins+gear
    contrib=net-fixed
    be=fixed/per_ticket_net(p,vat)
    return dict(name=name,tickets=t,price=p,gross=gross,vat=vatamt,fees=fees,sacem=sac,cnm=cnm,net=net,venue=venue,staff=staff,n=n_paid,sec=sec,mkt=mkt,ins=ins,gear=gear,fixed=fixed,contrib=contrib,be=be)
S=[night('Cautious',110,12,0.20,400,3,350,300,150,80,150),
   night('Base',180,15,0.20,0,4,350,300,200,80,150),
   night('Strong',250,18,0.20,0,5,350,300,250,80,150)]
for s in S:
    print({k:(round(v) if isinstance(v,float) else v) for k,v in s.items()})
print('net per ticket 15@20%',round(per_ticket_net(15,0.2),2),' 15@5.5%',round(per_ticket_net(15,0.055),2),' 12@20%',round(per_ticket_net(12,.2),2),' 18@20%',round(per_ticket_net(18,.2),2))
# sensitivity: base fixed costs, vary tickets and price
F=S[1]['fixed']
print('base fixed',F)
for p in (12,15,18):
    row=[round(t*per_ticket_net(p,0.2)-F) for t in (120,150,180,210,250)]
    print('price',p,row, 'BE',round(F/per_ticket_net(p,0.2)))
# pay sensitivity
for pay in (250,350,460):
    s=night('b',180,15,0.2,0,4,pay,300,200,80,150); print('pay',pay,round(s['contrib']),'BE',round(s['be']))
# VAT 5.5
s=night('b55',180,15,0.055,0,4,350,300,200,80,150); print('vat5.5',round(s['contrib']),'BE',round(s['be']))
# lean config: venue provides sound + security, 3 paid
s=night('lean',150,15,0.2,0,3,350,0,150,80,0); print('lean',round(s['contrib']),'fixed',s['fixed'],'BE',round(s['be']))
# aspiration night
s=night('asp',300,15,0.2,0,5,350,300,250,80,150); print('aspiration night',round(s['contrib']),'gross',s['gross'])
s=night('asp_hire',300,15,0.2,800,5,350,300,250,80,150); print('aspiration w hire',round(s['contrib']))
print('aspiration gross per month',3*300*15,'per year',12*3*300*15)
# setup
setup=dict(association=0,bank=60,insurance_annual=300,visuals_web=50,misc=90)
print('setup',sum(setup.values()))
# cash needed before event (base): marketing, insurance, gear deposit, venue deposit 0, setup
cash_before=S[1]['mkt']+S[1]['ins']+S[1]['gear']+sum(setup.values())
print('cash before base',cash_before)
# exposure if base event goes ahead with zero sales: all fixed + setup
print('max exposure base (zero sales, all committed)',S[1]['fixed']+sum(setup.values()))
# committed if cancelled at day -14 (assumption: marketing spent, insurance, setup, artists 0 if contract allows)
print('cancel at d-14 sunk (est.)',S[1]['mkt']+S[1]['ins']+sum(setup.values()))
