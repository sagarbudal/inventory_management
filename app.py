import streamlit as np
import streamlit as st
import pandas as pd
from datetime import datetime
from database import init_db, SessionLocal, Video, Equipment, Assignment

# Page configurations
st.set_page_config(
    page_title="Video & Equipment Manager",
    page_icon="📹",
    layout="wide"
)

# Initialize database tables
init_db()

# DB session manager helper
def get_db():
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        st.error(f"Database error: {e}")
        db.close()

# Styled header
st.title("📹 Video & Equipment Management Portal")
st.markdown("---")

# Navigation Sidebar
st.sidebar.title("Navigation")
menu_selection = st.sidebar.radio(
    "Select Screen:",
    ["Video Manager", "Inventory", "Distribution & Verification"]
)

# ---------------------------------------------------------
# TAB 1: VIDEO MANAGER
# ---------------------------------------------------------
if menu_selection == "Video Manager":
    st.header("🎬 Video Metadata Manager")
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.subheader("Add New Video")
        with st.form("add_video_form", clear_on_submit=True):
            video_name = st.text_input("Video Name", placeholder="e.g., Summer Campaign Promo")
            unique_code = st.text_input("Unique Code", placeholder="e.g., VID-2026-001")
            duration = st.number_input("Duration (minutes)", min_value=0.1, max_value=300.0, value=5.0, step=0.1)
            status = st.selectbox("Status", ["not uploaded", "uploaded"])
            category = st.selectbox("Category", ["Marketing", "Tutorial", "Vlog", "Documentary", "Social Media", "Corporate"])
            
            submit_video = st.form_submit_button("Add Video")
            
            if submit_video:
                if not video_name.strip() or not unique_code.strip():
                    st.error("Please fill in all fields.")
                else:
                    db = get_db()
                    try:
                        # Check unique code exists
                        existing = db.query(Video).filter(Video.unique_code == unique_code.strip()).first()
                        if existing:
                            st.error(f"A video with code '{unique_code}' already exists.")
                        else:
                            new_vid = Video(
                                name=video_name.strip(),
                                unique_code=unique_code.strip().upper(),
                                duration=duration,
                                status=status,
                                category=category
                            )
                            db.add(new_vid)
                            db.commit()
                            st.success(f"Successfully added video: {video_name}")
                    except Exception as e:
                        db.rollback()
                        st.error(f"Error saving video: {e}")
                    finally:
                        db.close()
                        
    with col2:
        st.subheader("Video Repository")
        db = get_db()
        videos_list = db.query(Video).all()
        db.close()
        
        if videos_list:
            # Build Pandas dataframe
            video_data = [{
                "ID": v.id,
                "Name": v.name,
                "Code": v.unique_code,
                "Duration (m)": v.duration,
                "Status": v.status,
                "Category": v.category
            } for v in videos_list]
            
            df = pd.DataFrame(video_data)
            st.dataframe(df, use_container_width=True)
            
            # Export to Excel
            try:
                import io
                buffer = io.BytesIO()
                with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
                    df.to_excel(writer, index=False, sheet_name="Videos Catalog")
                
                st.download_button(
                    label="📥 Export Catalog to Excel",
                    data=buffer.getvalue(),
                    file_name=f"videos_catalog_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                )
            except Exception as e:
                # Fallback to CSV if openpyxl isn't installed
                csv = df.to_csv(index=False).encode('utf-8')
                st.download_button(
                    label="📥 Export Catalog to CSV",
                    data=csv,
                    file_name="videos_catalog.csv",
                    mime="text/csv"
                )
        else:
            st.info("No videos in repository. Use the form to add some details.")

# ---------------------------------------------------------
# TAB 2: INVENTORY
# ---------------------------------------------------------
elif menu_selection == "Inventory":
    st.header("📦 Equipment Stock & Inventory")
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.subheader("Add New Equipment Stock")
        with st.form("add_equipment_form", clear_on_submit=True):
            eq_name = st.text_input("Equipment Name", placeholder="e.g., Sony A7 IV Camera")
            quantity = st.number_input("Total Quantity", min_value=1, value=5, step=1)
            
            submit_eq = st.form_submit_button("Add to Stock")
            
            if submit_eq:
                if not eq_name.strip():
                    st.error("Please enter equipment name.")
                else:
                    db = get_db()
                    try:
                        # Check if exists
                        existing = db.query(Equipment).filter(Equipment.equipment_name.ilike(eq_name.strip())).first()
                        if existing:
                            # Update quantity
                            existing.total_quantity += quantity
                            existing.available_quantity += quantity
                            st.success(f"Updated existing equipment stock: {eq_name.strip()} (+{quantity})")
                        else:
                            new_eq = Equipment(
                                equipment_name=eq_name.strip(),
                                total_quantity=quantity,
                                available_quantity=quantity
                            )
                            db.add(new_eq)
                            st.success(f"Added new equipment item: {eq_name.strip()} ({quantity} units)")
                        db.commit()
                    except Exception as e:
                        db.rollback()
                        st.error(f"Error adding stock: {e}")
                    finally:
                        db.close()
                        
    with col2:
        st.subheader("Active Stock Level Dashboard")
        db = get_db()
        items = db.query(Equipment).all()
        db.close()
        
        if items:
            eq_data = []
            for item in items:
                # Add alert checks
                status_indicator = "✅ Fully Available"
                if item.available_quantity == 0:
                    status_indicator = "🚨 Out of Stock"
                elif item.available_quantity < (item.total_quantity / 3):
                    status_indicator = "⚠️ Low stock"
                
                eq_data.append({
                    "ID": item.id,
                    "Equipment Name": item.equipment_name,
                    "Total Stock": item.total_quantity,
                    "Available Stock": item.available_quantity,
                    "Status": status_indicator
                })
            
            df_eq = pd.DataFrame(eq_data)
            st.dataframe(df_eq, use_container_width=True)
            
            # Simple stock visualization metrics
            st.markdown("### Stock Overview Quick Metrics")
            m_cols = st.columns(min(len(items), 4))
            for index, item in enumerate(items[:4]): # top 4
                with m_cols[index % 4]:
                    st.metric(
                        label=item.equipment_name,
                        value=f"{item.available_quantity} / {item.total_quantity}",
                        delta=f"{item.available_quantity} Avail"
                    )
        else:
            st.info("No equipment in inventory. Register some using the standard registration form.")

# ---------------------------------------------------------
# TAB 3: DISTRIBUTION & VERIFICATION
# ---------------------------------------------------------
elif menu_selection == "Distribution & Verification":
    st.header("📋 Equipment Distribution & Verification")
    
    # Render two split columns: checkout on left, reclaim/nightly on right
    col_out, col_in = st.columns([1, 1.2])
    
    with col_out:
        st.subheader("🔑 Check-Out System")
        db = get_db()
        # Only select equipment that has available quantity > 0
        avail_equipment = db.query(Equipment).filter(Equipment.available_quantity > 0).all()
        db.close()
        
        if not avail_equipment:
            st.warning("⚠️ No equipment currently available in stock for check-out.")
        else:
            with st.form("checkout_form", clear_on_submit=True):
                # Dropdown
                eq_options = {f"{eq.equipment_name} ({eq.available_quantity} avail)": eq.id for eq in avail_equipment}
                selected_label = st.selectbox("Select Equipment", options=list(eq_options.keys()))
                user_name = st.text_input("Receiving Employee / User Name", placeholder="e.g., Jane Cooper")
                checkout_date = st.date_input("Checkout Date", value=datetime.today())
                
                submit_checkout = st.form_submit_button("Initiate Check-Out")
                
                if submit_checkout:
                    if not user_name.strip():
                        st.error("Please specify checking out user name.")
                    else:
                        db = get_db()
                        try:
                            eq_id = eq_options[selected_label]
                            equipment_item = db.query(Equipment).filter(Equipment.id == eq_id).first()
                            
                            if equipment_item and equipment_item.available_quantity > 0:
                                # Decrease available quantity
                                equipment_item.available_quantity -= 1
                                
                                # Register assignment
                                new_assignment = Assignment(
                                    equipment_id=eq_id,
                                    user_name=user_name.strip(),
                                    checkout_date=checkout_date.strftime("%Y-%m-%d"),
                                    status="Out"
                                )
                                db.add(new_assignment)
                                db.commit()
                                st.success(f"✓ Checked out {equipment_item.equipment_name} to {user_name.strip()}!")
                            else:
                                st.error("Item became unavailable.")
                        except Exception as e:
                            db.rollback()
                            st.error(f"Checkout transaction failed: {e}")
                        finally:
                            db.close()
                            # Force refresh to update dropdowns and tables
                            st.rerun()
                            
    with col_in:
        st.subheader("🌙 Nightly Distribution Verification")
        db = get_db()
        # Find all with status 'Out'
        out_assignments = db.query(Assignment).filter(Assignment.status == "Out").all()
        
        if not out_assignments:
            st.info("✨ Perfect! All Checked-Out items have been successfully returned.")
            db.close()
        else:
            st.caption("The lists below shows all equipment distributions currently flagged as out in field. Perform returns here to re-increment inventory stock.")
            
            for index, booking in enumerate(out_assignments):
                container_box = st.container(border=True)
                with container_box:
                    c1, c2, c3 = st.columns([1.5, 1.2, 0.8])
                    with c1:
                        st.markdown(f"**Item Name:** `{booking.equipment.equipment_name}`")
                        st.markdown(f"🧑 **User:** {booking.user_name}")
                    with c2:
                        st.markdown(f"📅 **Date Out:** `{booking.checkout_date}`")
                        status_tag = "🔴 Status: OUT"
                        st.markdown(status_tag)
                    with c3:
                        # Reclaim button
                        reclaim_clicked = st.button("Reclaim Inventory", key=f"reclaim_btn_{booking.assignment_id}_{index}")
                        if reclaim_clicked:
                            try:
                                # Update assignment
                                booking.status = "Returned"
                                # Update equipment count
                                parent_equipment = db.query(Equipment).filter(Equipment.id == booking.equipment_id).first()
                                if parent_equipment:
                                    parent_equipment.available_quantity = min(
                                        parent_equipment.available_quantity + 1,
                                        parent_equipment.total_quantity
                                    )
                                db.commit()
                                st.toast(f"Reclaimed {booking.equipment.equipment_name} stock successfully!")
                                st.rerun()
                            except Exception as e:
                                db.rollback()
                                st.error(f"Reclaim error: {e}")
            db.close()
