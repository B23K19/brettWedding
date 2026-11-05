import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Invitation } from './invitation';

describe('Invitation', () => {
  let component: Invitation;
  let fixture: ComponentFixture<Invitation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Invitation],
    }).compileComponents();

    fixture = TestBed.createComponent(Invitation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
