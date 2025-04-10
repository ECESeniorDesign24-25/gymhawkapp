import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Select from 'react-select';
import Footer from '@/components/footer';
import Banner from '@/components/banner';
import styles from '@/styles/index.module.css';
import { HOME_STYLE } from '@/styles/customStyles';

export default function About() {
    return (
        <div className={styles.container}>
            <Banner />
            <div className={styles.aboutContainer}>
                <h1 className={styles.title}>About</h1>

                <p className={styles.description}>
                    We developed this project as a web-based application that enables users to monitor the usage of machines in the University of Iowa Recreation Services facilities. Based off the following project statement, we developed this application to assist gym-goers providing near immediate insights on machine usage.
                        <br />
                        <br />
                </p>

                <h3 className={styles.subtitle}>Problem Statement</h3>

                With the growing popularity of fitness in today’s society, gyms have become increasingly crowded, especially during peak hours, resulting in longer wait times and overcrowded equipment. Many gym-goers often find themselves waiting 10 to 15 minutes to use their preferred machine upon arriving at the gym. This issue affects both members and gym management, as the frustration can lead some to cancel their memberships or switch to another gym.
To address these challenges, this project proposes the development of a sensor-based system that tracks gym machine usage in real-time. Connected to a user-facing mobile application, this system will display the availability of equipment, offering gym-goers immediate updates on the status of machines like treadmills and weight machines. By providing users with usage information, the tool will help members plan their visits more effectively, reducing wait times and increasing the overall efficiency of their workouts.
                
                <br /><br />

                <h3 className={styles.subtitle}>Meet the Team</h3>

                <p className={styles.description}>
                    You can meet our development team at our{' '}
                    <a
                        className={styles.teamLink}
                        href="https://myweb.uiowa.edu/jbkrueger/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        website
                    </a>.
                </p>
            </div>
            <Footer />
        </div>
    );
}
